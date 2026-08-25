// このファイルは自動生成です。手で編集しないこと。
// 生成: node scripts/build-nutrition.mjs
// 対応表(どの食品を載せるか): scripts/nutrition-foods.mjs
// 出典: 日本食品標準成分表（八訂）増補2023年（文部科学省）
//       https://www.mext.go.jp/a_menu/syokuhinseibun/mext_00001.html
// 成分値は上記公式Excelの「表全体」シートから機械的に抽出したもの（可食部100gあたり）。
// Tr(微量)・-(未測定)は0として扱い、()付きの推計値はそのまま数値として使っている。

export interface NutritionPer100g {
  kcal: number
  proteinG: number
  fatG: number
  carbG: number
  saltG: number
  /** 食物繊維総量(g)。2026-07-13 第2弾で追加 */
  fiberG: number
  /** 鉄(mg) */
  ironMg: number
  /** カルシウム(mg) */
  calciumMg: number
}

export interface NutritionFood {
  /** 八訂の食品番号（blendの場合は "番号+番号"） */
  id: string
  /** アプリでの表示名 */
  label: string
  /** 公式の収載食品名（照合の証跡） */
  mextName: string
  /** この食品に名寄せする材料名（実行時にtoHiraganaで正規化して使う） */
  aliases: string[]
  /** 正規化前の完全一致だけで照合する別名（「鮭」vs「酒」のような衝突回避用） */
  rawAliases?: string[]
  /** 可食部100gあたりの成分値 */
  per100g: NutritionPer100g
  /** 単位1つあたりの重さ(g)。可食部の代表値による概算 */
  unitGrams?: Record<string, number>
  /** 1mlあたりの重さ(g)。ml/cc、および大さじ15ml/小さじ5ml/カップ200mlの換算に使う */
  gramsPerMl?: number
  note?: string
}

export interface NutritionData {
  source: string
  sourcePage: string
  sourceFile: string
  generatedAt: string
  dbVersion: number
  foods: NutritionFood[]
}

export const NUTRITION_DATA: NutritionData = {
  "source": "日本食品標準成分表（八訂）増補2023年（文部科学省）",
  "sourcePage": "https://www.mext.go.jp/a_menu/syokuhinseibun/mext_00001.html",
  "sourceFile": "https://www.mext.go.jp/content/20260327-mxt_kagsei-mext-000029402_02.xlsx",
  "generatedAt": "2026-08-25",
  "dbVersion": 9,
  "foods": [
    {
      "id": "06153",
      "label": "玉ねぎ",
      "mextName": "（たまねぎ類） たまねぎ りん茎 生",
      "aliases": [
        "玉ねぎ",
        "新玉ねぎ"
      ],
      "per100g": {
        "kcal": 33,
        "proteinG": 1,
        "fatG": 0.1,
        "carbG": 8.4,
        "saltG": 0,
        "fiberG": 1.5,
        "ironMg": 0.3,
        "calciumMg": 17
      },
      "unitGrams": {
        "個": 200,
        "玉": 200
      }
    },
    {
      "id": "02017",
      "label": "じゃがいも",
      "mextName": "＜いも類＞ じゃがいも 塊茎 皮なし 生",
      "aliases": [
        "じゃがいも",
        "じゃが芋",
        "メークイン",
        "男爵いも"
      ],
      "per100g": {
        "kcal": 59,
        "proteinG": 1.8,
        "fatG": 0.1,
        "carbG": 17.3,
        "saltG": 0,
        "fiberG": 3.1,
        "ironMg": 0.4,
        "calciumMg": 4
      },
      "unitGrams": {
        "個": 135
      },
      "note": "食物繊維のみ 02019「＜いも類＞ じゃがいも 塊茎 皮なし 水煮」から採用（3.1g/100g）"
    },
    {
      "id": "06212",
      "label": "にんじん",
      "mextName": "（にんじん類） にんじん 根 皮つき 生",
      "aliases": [
        "にんじん"
      ],
      "per100g": {
        "kcal": 35,
        "proteinG": 0.7,
        "fatG": 0.2,
        "carbG": 9.3,
        "saltG": 0.1,
        "fiberG": 2.8,
        "ironMg": 0.2,
        "calciumMg": 28
      },
      "unitGrams": {
        "本": 135
      }
    },
    {
      "id": "06061",
      "label": "キャベツ",
      "mextName": "（キャベツ類） キャベツ 結球葉 生",
      "aliases": [
        "キャベツ",
        "春キャベツ"
      ],
      "per100g": {
        "kcal": 23,
        "proteinG": 1.2,
        "fatG": 0.1,
        "carbG": 5.2,
        "saltG": 0,
        "fiberG": 1.8,
        "ironMg": 0.3,
        "calciumMg": 42
      },
      "unitGrams": {
        "枚": 50,
        "玉": 1000,
        "個": 1000
      }
    },
    {
      "id": "06132",
      "label": "大根",
      "mextName": "（だいこん類） だいこん 根 皮つき 生",
      "aliases": [
        "大根"
      ],
      "per100g": {
        "kcal": 15,
        "proteinG": 0.5,
        "fatG": 0.1,
        "carbG": 4.1,
        "saltG": 0,
        "fiberG": 1.4,
        "ironMg": 0.2,
        "calciumMg": 24
      },
      "unitGrams": {
        "本": 750
      }
    },
    {
      "id": "06233",
      "label": "白菜",
      "mextName": "はくさい 結球葉 生",
      "aliases": [
        "白菜"
      ],
      "per100g": {
        "kcal": 13,
        "proteinG": 0.8,
        "fatG": 0.1,
        "carbG": 3.2,
        "saltG": 0,
        "fiberG": 1.3,
        "ironMg": 0.3,
        "calciumMg": 43
      },
      "unitGrams": {
        "枚": 100,
        "株": 1900,
        "個": 1900
      }
    },
    {
      "id": "06226",
      "label": "長ねぎ",
      "mextName": "（ねぎ類） 根深ねぎ 葉 軟白 生",
      "aliases": [
        "長ねぎ",
        "白ねぎ",
        "根深ねぎ",
        "長葱",
        "ねぎ",
        "葱"
      ],
      "per100g": {
        "kcal": 35,
        "proteinG": 1.4,
        "fatG": 0.1,
        "carbG": 8.3,
        "saltG": 0,
        "fiberG": 2.5,
        "ironMg": 0.3,
        "calciumMg": 36
      },
      "unitGrams": {
        "本": 100,
        "cm": 3
      },
      "note": "「長ねぎ(青い部分)」「長ねぎ(白い部分)」はcm表記(2026-07-21・栄養カバレッジ監査で追加)。本1本=100g・約30cmの目安から1cmあたり約3gで換算。2026-08-23 便KF: 素の「ねぎ」を別名に足した。実データで『ねぎ 1/2本』『ねぎ 1/4本』が成分データ無しで落ち、野菜量が0gになる品が出ていた。単位「本」で書かれる「ねぎ」は根深ねぎ(長ねぎ)を指す(青ねぎ・小ねぎ・万能ねぎはそれぞれ書き分けられており、別の食品として持っている)。読みが2文字なので部分一致(3文字以上)には入らず、「玉ねぎ」「小ねぎ」などを巻き込むことはない"
    },
    {
      "id": "06227",
      "label": "青ねぎ",
      "mextName": "（ねぎ類） 葉ねぎ 葉 生",
      "aliases": [
        "青ねぎ",
        "葉ねぎ",
        "刻みねぎ"
      ],
      "per100g": {
        "kcal": 29,
        "proteinG": 1.9,
        "fatG": 0.3,
        "carbG": 6.5,
        "saltG": 0,
        "fiberG": 3.2,
        "ironMg": 1,
        "calciumMg": 80
      },
      "unitGrams": {
        "本": 10
      }
    },
    {
      "id": "06228",
      "label": "小ねぎ",
      "mextName": "（ねぎ類） こねぎ 葉 生",
      "aliases": [
        "小ねぎ",
        "こねぎ",
        "万能ねぎ",
        "細ねぎ",
        "小口ねぎ"
      ],
      "per100g": {
        "kcal": 26,
        "proteinG": 2,
        "fatG": 0.3,
        "carbG": 5.4,
        "saltG": 0,
        "fiberG": 2.5,
        "ironMg": 1,
        "calciumMg": 100
      },
      "unitGrams": {
        "本": 5
      },
      "note": "2026-08-25 便KP: 「小口ねぎ」を別名に足した(実データAの『小口ねぎ 5g』が成分表でも価格マスタでも落ちていた)。小口切りにして売られている細いねぎのことで、中身は小ねぎ。成分値は変えていない"
    },
    {
      "id": "06103",
      "label": "しょうが",
      "mextName": "（しょうが類） しょうが 根茎 皮なし 生",
      "aliases": [
        "しょうが"
      ],
      "per100g": {
        "kcal": 28,
        "proteinG": 0.9,
        "fatG": 0.3,
        "carbG": 6.6,
        "saltG": 0,
        "fiberG": 2.1,
        "ironMg": 0.5,
        "calciumMg": 12
      },
      "unitGrams": {
        "かけ": 10,
        "片": 10,
        "大さじ": 15,
        "小さじ": 5
      },
      "note": "大さじ/小さじはおろししょうが(チューブ)と同じ換算値(2026-07-21追加。「しょうが(すりおろし)」の名寄せ対応)"
    },
    {
      "id": "06223",
      "label": "にんにく",
      "mextName": "（にんにく類） にんにく りん茎 生",
      "aliases": [
        "にんにく"
      ],
      "per100g": {
        "kcal": 129,
        "proteinG": 6.4,
        "fatG": 0.9,
        "carbG": 27.5,
        "saltG": 0,
        "fiberG": 6.2,
        "ironMg": 0.8,
        "calciumMg": 14
      },
      "unitGrams": {
        "かけ": 6,
        "片": 6,
        "玉": 45,
        "大さじ": 15,
        "小さじ": 5
      },
      "note": "2026-08-25 便KL: 「大さじ」「小さじ」を足した。さじで書かれたにんにくはすりおろした状態を指すので、同じファイルのしょうが(06103)が「大さじ/小さじはおろししょうが(チューブ)と同じ換算値」として持っているのと同じ扱いにする。値もおろしにんにく(チューブ・17076)が既に持つ 大さじ15g/小さじ5g をそのまま使う(新しい数値は作っていない)。影響範囲テストAの麻婆豆腐『ニンニク 1/2小さじ』が単位を換算できずに落ちていた"
    },
    {
      "id": "06245",
      "label": "ピーマン",
      "mextName": "（ピーマン類） 青ピーマン 果実 生",
      "aliases": [
        "ピーマン"
      ],
      "per100g": {
        "kcal": 20,
        "proteinG": 0.9,
        "fatG": 0.2,
        "carbG": 5.1,
        "saltG": 0,
        "fiberG": 2.3,
        "ironMg": 0.4,
        "calciumMg": 11
      },
      "unitGrams": {
        "個": 30
      }
    },
    {
      "id": "06182",
      "label": "トマト",
      "mextName": "（トマト類） 赤色トマト 果実 生",
      "aliases": [
        "トマト"
      ],
      "per100g": {
        "kcal": 20,
        "proteinG": 0.7,
        "fatG": 0.1,
        "carbG": 4.7,
        "saltG": 0,
        "fiberG": 1,
        "ironMg": 0.2,
        "calciumMg": 7
      },
      "unitGrams": {
        "個": 150
      }
    },
    {
      "id": "06183",
      "label": "ミニトマト",
      "mextName": "（トマト類） 赤色ミニトマト 果実 生",
      "aliases": [
        "ミニトマト",
        "プチトマト"
      ],
      "per100g": {
        "kcal": 30,
        "proteinG": 1.1,
        "fatG": 0.1,
        "carbG": 7.2,
        "saltG": 0,
        "fiberG": 1.4,
        "ironMg": 0.4,
        "calciumMg": 12
      },
      "unitGrams": {
        "個": 15
      }
    },
    {
      "id": "06065",
      "label": "きゅうり",
      "mextName": "きゅうり 果実 生",
      "aliases": [
        "きゅうり"
      ],
      "per100g": {
        "kcal": 13,
        "proteinG": 1,
        "fatG": 0.1,
        "carbG": 3,
        "saltG": 0,
        "fiberG": 1.1,
        "ironMg": 0.3,
        "calciumMg": 26
      },
      "unitGrams": {
        "本": 100
      }
    },
    {
      "id": "06191",
      "label": "なす",
      "mextName": "（なす類） なす 果実 生",
      "aliases": [
        "なす"
      ],
      "per100g": {
        "kcal": 18,
        "proteinG": 1.1,
        "fatG": 0.1,
        "carbG": 5.1,
        "saltG": 0,
        "fiberG": 2.2,
        "ironMg": 0.3,
        "calciumMg": 18
      },
      "unitGrams": {
        "本": 80
      }
    },
    {
      "id": "06048",
      "label": "かぼちゃ",
      "mextName": "（かぼちゃ類） 西洋かぼちゃ 果実 生",
      "aliases": [
        "かぼちゃ"
      ],
      "per100g": {
        "kcal": 78,
        "proteinG": 1.9,
        "fatG": 0.3,
        "carbG": 20.6,
        "saltG": 0,
        "fiberG": 3.5,
        "ironMg": 0.4,
        "calciumMg": 22
      },
      "unitGrams": {
        "個": 1000
      }
    },
    {
      "id": "06084",
      "label": "ごぼう",
      "mextName": "（ごぼう類） ごぼう 根 生",
      "aliases": [
        "ごぼう"
      ],
      "per100g": {
        "kcal": 58,
        "proteinG": 1.8,
        "fatG": 0.1,
        "carbG": 15.4,
        "saltG": 0,
        "fiberG": 5.7,
        "ironMg": 0.7,
        "calciumMg": 46
      },
      "unitGrams": {
        "本": 140
      }
    },
    {
      "id": "06317",
      "label": "れんこん",
      "mextName": "れんこん 根茎 生",
      "aliases": [
        "れんこん"
      ],
      "per100g": {
        "kcal": 66,
        "proteinG": 1.9,
        "fatG": 0.1,
        "carbG": 15.5,
        "saltG": 0.1,
        "fiberG": 2,
        "ironMg": 0.5,
        "calciumMg": 20
      },
      "unitGrams": {
        "節": 150
      }
    },
    {
      "id": "06291",
      "label": "もやし",
      "mextName": "（もやし類） りょくとうもやし 生",
      "aliases": [
        "もやし"
      ],
      "per100g": {
        "kcal": 15,
        "proteinG": 1.8,
        "fatG": 0.1,
        "carbG": 2.4,
        "saltG": 0,
        "fiberG": 1.3,
        "ironMg": 0.2,
        "calciumMg": 9
      },
      "unitGrams": {
        "袋": 200
      }
    },
    {
      "id": "06287",
      "label": "豆もやし",
      "mextName": "（もやし類） だいずもやし 生",
      "aliases": [
        "豆もやし"
      ],
      "per100g": {
        "kcal": 29,
        "proteinG": 3.6,
        "fatG": 1.4,
        "carbG": 2.5,
        "saltG": 0,
        "fiberG": 2.3,
        "ironMg": 0.5,
        "calciumMg": 25
      },
      "unitGrams": {
        "袋": 200
      }
    },
    {
      "id": "06263",
      "label": "ブロッコリー",
      "mextName": "ブロッコリー 花序 生",
      "aliases": [
        "ブロッコリー"
      ],
      "per100g": {
        "kcal": 37,
        "proteinG": 5.4,
        "fatG": 0.6,
        "carbG": 6.6,
        "saltG": 0,
        "fiberG": 5.1,
        "ironMg": 1.3,
        "calciumMg": 50
      },
      "unitGrams": {
        "株": 200,
        "個": 200,
        "房": 15
      },
      "note": "2026-08-25 便KL: 「個」を足した。ブロッコリーは1株を「1個」とも言う同じものの言い方ちがいで、重さは既存の「株」の代表値をそのまま使う(新しい数値は作っていない)。キャベツ(玉1000/個1000)・白菜(株1900/個1900)・レタス(玉300/個300)が既に同じ形で両方を持つ。影響範囲テストC「時短の人」の『ブロッコリー 1個』『ブロッコリーの茎 1個分』が単位を換算できずに落ち、1品まるごとの野菜量が0gになっていた(「個分」は既存の「◯◯分」の読み替えで「個」に落ちる)"
    },
    {
      "id": "06267",
      "label": "ほうれん草",
      "mextName": "ほうれんそう 葉 通年平均 生",
      "aliases": [
        "ほうれん草"
      ],
      "per100g": {
        "kcal": 18,
        "proteinG": 2.2,
        "fatG": 0.4,
        "carbG": 3.1,
        "saltG": 0,
        "fiberG": 2.8,
        "ironMg": 2,
        "calciumMg": 49
      },
      "unitGrams": {
        "束": 180,
        "株": 20,
        "袋": 200
      },
      "note": "袋は「豆腐グラタン」レシピのmemo「1袋=約200gが目安」から(2026-07-21追加)"
    },
    {
      "id": "06086",
      "label": "小松菜",
      "mextName": "こまつな 葉 生",
      "aliases": [
        "小松菜"
      ],
      "per100g": {
        "kcal": 13,
        "proteinG": 1.5,
        "fatG": 0.2,
        "carbG": 2.4,
        "saltG": 0,
        "fiberG": 1.9,
        "ironMg": 2.8,
        "calciumMg": 170
      },
      "unitGrams": {
        "束": 250,
        "袋": 250,
        "株": 40
      },
      "note": "2026-08-25 便KL: 「袋」を足した。小松菜は1束をそのまま袋に詰めて売るので、売り場の「1袋」と成分表の「1束」は同じものを指す言い方ちがい。重さは既存の「束」の代表値をそのまま使う(新しい数値は作っていない)。影響範囲テストA「節約したい人」の『小松菜 1袋』が単位を換算できずに落ち、「簡単！厚揚げと小松菜の煮浸し」が1食8円・1人分32kcalと出ていた"
    },
    {
      "id": "06072",
      "label": "水菜",
      "mextName": "みずな 葉 生",
      "aliases": [
        "水菜",
        "みずな"
      ],
      "per100g": {
        "kcal": 23,
        "proteinG": 2.2,
        "fatG": 0.1,
        "carbG": 4.8,
        "saltG": 0.1,
        "fiberG": 3,
        "ironMg": 2.1,
        "calciumMg": 210
      },
      "unitGrams": {
        "束": 200,
        "袋": 200,
        "株": 40
      },
      "note": "2026-08-25 便KL: 「袋」を足した。根拠は小松菜と同じ(1束をそのまま袋詰めして売る＝同じ売り単位の言い方ちがい)。重さは既存の「束」の代表値をそのまま使う。影響範囲テストCの『水菜 1/2袋』が単位を換算できずに落ち、サラダの主材料が計算に入っていなかった"
    },
    {
      "id": "06160",
      "label": "チンゲン菜",
      "mextName": "チンゲンサイ 葉 生",
      "aliases": [
        "チンゲン菜",
        "チンゲンサイ",
        "青梗菜"
      ],
      "per100g": {
        "kcal": 9,
        "proteinG": 0.6,
        "fatG": 0.1,
        "carbG": 2,
        "saltG": 0.1,
        "fiberG": 1.2,
        "ironMg": 1.1,
        "calciumMg": 100
      },
      "unitGrams": {
        "株": 85
      }
    },
    {
      "id": "06207",
      "label": "ニラ",
      "mextName": "（にら類） にら 葉 生",
      "aliases": [
        "ニラ",
        "韮"
      ],
      "per100g": {
        "kcal": 18,
        "proteinG": 1.7,
        "fatG": 0.3,
        "carbG": 4,
        "saltG": 0,
        "fiberG": 2.7,
        "ironMg": 0.7,
        "calciumMg": 48
      },
      "unitGrams": {
        "束": 95,
        "袋": 95
      },
      "note": "2026-08-25 便KL: 「袋」を足した。根拠は小松菜・水菜と同じ(1束をそのまま袋詰めして売る)。重さは既存の「束」の代表値をそのまま使う。2026-08-23 便KEの申し送りで名指しされた葉物3つ(小松菜・ほうれん草・にら)のうちの1つ(ほうれん草は「袋」を既に持っている)。**影響範囲テストの90品には「にら 1袋」は1件も出てこない**ので実データでの再現はできていないが、新しい重さを作らない読み替えなので、外れても既存の「束」と同じ量にしかならない"
    },
    {
      "id": "06312",
      "label": "レタス",
      "mextName": "（レタス類） レタス 土耕栽培 結球葉 生",
      "aliases": [
        "レタス"
      ],
      "per100g": {
        "kcal": 11,
        "proteinG": 0.6,
        "fatG": 0.1,
        "carbG": 2.8,
        "saltG": 0,
        "fiberG": 1.1,
        "ironMg": 0.3,
        "calciumMg": 19
      },
      "unitGrams": {
        "枚": 30,
        "玉": 300,
        "個": 300
      }
    },
    {
      "id": "06315",
      "label": "サニーレタス",
      "mextName": "（レタス類） サニーレタス 葉 生",
      "aliases": [
        "サニーレタス"
      ],
      "per100g": {
        "kcal": 15,
        "proteinG": 1.2,
        "fatG": 0.2,
        "carbG": 3.2,
        "saltG": 0,
        "fiberG": 2,
        "ironMg": 1.8,
        "calciumMg": 66
      },
      "unitGrams": {
        "枚": 15
      }
    },
    {
      "id": "06313",
      "label": "サラダ菜",
      "mextName": "（レタス類） サラダな 葉 生",
      "aliases": [
        "サラダ菜",
        "サラダな"
      ],
      "per100g": {
        "kcal": 10,
        "proteinG": 1,
        "fatG": 0.2,
        "carbG": 2.7,
        "saltG": 0,
        "fiberG": 1.8,
        "ironMg": 2.4,
        "calciumMg": 56
      },
      "unitGrams": {
        "枚": 10
      },
      "note": "2026-08-25 便KP: 影響範囲テストAの「鶏むね照り焼き」の添え物『サラダ菜 適量』が成分表に無くて落ちていた。八訂は（レタス類）の中にレタス・サニーレタス・リーフレタスと並べて06313「サラダな」を実収載している。1枚10gは同じレタス類のサニーレタス(1枚15g)より小ぶりな葉という位置づけで置いた概算"
    },
    {
      "id": "06314",
      "label": "グリーンリーフ",
      "mextName": "（レタス類） リーフレタス 葉 生",
      "aliases": [
        "グリーンリーフ",
        "リーフレタス",
        "グリーンリーフレタス"
      ],
      "per100g": {
        "kcal": 16,
        "proteinG": 1.4,
        "fatG": 0.1,
        "carbG": 3.3,
        "saltG": 0,
        "fiberG": 1.9,
        "ironMg": 1,
        "calciumMg": 58
      },
      "unitGrams": {
        "枚": 15
      },
      "note": "2026-08-25 便KP: 影響範囲テストCの『グリーンリーフ 適量』が落ちていた。売り場の「グリーンリーフ」は八訂06314「リーフレタス」と同じもの(結球しない緑色の葉レタス)。1枚15gは同じレタス類のサニーレタス(06315・1枚15g)の値をそのまま使っている(新しい重さは作っていない)"
    },
    {
      "id": "06201",
      "label": "菜の花",
      "mextName": "（なばな類） 和種なばな 花らい・茎 生",
      "aliases": [
        "菜の花",
        "菜花",
        "なばな"
      ],
      "per100g": {
        "kcal": 34,
        "proteinG": 4.4,
        "fatG": 0.2,
        "carbG": 5.8,
        "saltG": 0,
        "fiberG": 4.2,
        "ironMg": 2.9,
        "calciumMg": 160
      },
      "note": "2026-08-25 便KP: 影響範囲テストBの『菜の花 1束』が成分表に無くて落ちていた。八訂は「和種なばな(花らい・茎)」と「洋種なばな(茎葉)」を分けて収載しており、日本のスーパーで「菜の花」として売られているつぼみ付きの束は和種(06201)。**「1束」が何gかは調べがつかなかったので入れていない**＝1束と書かれた行は今も対象外のまま(嘘の重さを作らない)。グラムで書けば計算できる"
    },
    {
      "id": "06329",
      "label": "豆苗",
      "mextName": "（えんどう類） トウミョウ 芽ばえ 生",
      "aliases": [
        "豆苗",
        "とうみょう"
      ],
      "per100g": {
        "kcal": 27,
        "proteinG": 3.8,
        "fatG": 0.4,
        "carbG": 3.2,
        "saltG": 0,
        "fiberG": 2.2,
        "ironMg": 0.8,
        "calciumMg": 7
      },
      "unitGrams": {
        "パック": 100,
        "袋": 100
      },
      "note": "2026-08-25 便KP: 影響範囲テストA・Cの『豆苗 1パック』『豆苗 1袋』が成分表に無く、**1品まるごと野菜量0g**になっていた(価格マスタには「豆苗 100円/1パック」があるのに、成分表に無いせいで原価の按分もできなかった)。八訂は06329「（えんどう類）トウミョウ 芽ばえ 生」で**スーパーで売っている根付きパックの豆苗そのもの**を実収載している(06019「茎葉」は畑で育てた大きい方なので採らない)。1パック=100gは、根を落とした可食部の実測がおおむね99g(村上農園の1パック約100g・楽天/生活知恵袋の実測98.9g)で3ソースが一致したことによる。「1袋」はパックと同じものの言い方ちがい"
    },
    {
      "id": "06119",
      "label": "セロリ",
      "mextName": "セロリ 葉柄 生",
      "aliases": [
        "セロリ"
      ],
      "per100g": {
        "kcal": 12,
        "proteinG": 0.4,
        "fatG": 0.1,
        "carbG": 3.6,
        "saltG": 0.1,
        "fiberG": 1.5,
        "ironMg": 0.2,
        "calciumMg": 39
      },
      "unitGrams": {
        "本": 65
      }
    },
    {
      "id": "06007",
      "label": "アスパラガス",
      "mextName": "アスパラガス 若茎 生",
      "aliases": [
        "アスパラガス",
        "アスパラ"
      ],
      "per100g": {
        "kcal": 21,
        "proteinG": 2.6,
        "fatG": 0.2,
        "carbG": 3.9,
        "saltG": 0,
        "fiberG": 1.8,
        "ironMg": 0.7,
        "calciumMg": 19
      },
      "unitGrams": {
        "本": 20
      }
    },
    {
      "id": "06010",
      "label": "いんげん",
      "mextName": "いんげんまめ さやいんげん 若ざや 生",
      "aliases": [
        "いんげん",
        "さやいんげん"
      ],
      "per100g": {
        "kcal": 23,
        "proteinG": 1.8,
        "fatG": 0.1,
        "carbG": 5.1,
        "saltG": 0,
        "fiberG": 2.4,
        "ironMg": 0.7,
        "calciumMg": 50
      },
      "unitGrams": {
        "本": 7
      }
    },
    {
      "id": "06020",
      "label": "絹さや",
      "mextName": "（えんどう類） さやえんどう 若ざや 生",
      "aliases": [
        "絹さや",
        "さやえんどう"
      ],
      "per100g": {
        "kcal": 38,
        "proteinG": 3.1,
        "fatG": 0.2,
        "carbG": 7.5,
        "saltG": 0,
        "fiberG": 3,
        "ironMg": 0.9,
        "calciumMg": 35
      },
      "unitGrams": {
        "枚": 2
      }
    },
    {
      "id": "06023",
      "label": "グリーンピース",
      "mextName": "（えんどう類） グリンピース 生",
      "aliases": [
        "グリーンピース",
        "グリンピース"
      ],
      "per100g": {
        "kcal": 76,
        "proteinG": 6.9,
        "fatG": 0.4,
        "carbG": 15.3,
        "saltG": 0,
        "fiberG": 7.7,
        "ironMg": 1.7,
        "calciumMg": 23
      }
    },
    {
      "id": "06032",
      "label": "オクラ",
      "mextName": "オクラ 果実 生",
      "aliases": [
        "オクラ"
      ],
      "per100g": {
        "kcal": 26,
        "proteinG": 2.1,
        "fatG": 0.2,
        "carbG": 6.6,
        "saltG": 0,
        "fiberG": 5,
        "ironMg": 0.5,
        "calciumMg": 92
      },
      "unitGrams": {
        "本": 7
      }
    },
    {
      "id": "06205",
      "label": "ゴーヤ",
      "mextName": "にがうり 果実 生",
      "aliases": [
        "ゴーヤ",
        "ゴーヤー",
        "にがうり",
        "苦瓜"
      ],
      "per100g": {
        "kcal": 15,
        "proteinG": 1,
        "fatG": 0.1,
        "carbG": 3.9,
        "saltG": 0,
        "fiberG": 2.6,
        "ironMg": 0.4,
        "calciumMg": 14
      },
      "unitGrams": {
        "本": 250
      },
      "note": "第8弾ゴーヤチャンプルーで初登場(2026-07-11)"
    },
    {
      "id": "06036",
      "label": "かぶ",
      "mextName": "かぶ 根 皮つき 生",
      "aliases": [
        "かぶ",
        "蕪"
      ],
      "per100g": {
        "kcal": 18,
        "proteinG": 0.7,
        "fatG": 0.1,
        "carbG": 4.6,
        "saltG": 0,
        "fiberG": 1.5,
        "ironMg": 0.3,
        "calciumMg": 24
      },
      "unitGrams": {
        "個": 75
      }
    },
    {
      "id": "06116",
      "label": "ズッキーニ",
      "mextName": "ズッキーニ 果実 生",
      "aliases": [
        "ズッキーニ"
      ],
      "per100g": {
        "kcal": 16,
        "proteinG": 1.3,
        "fatG": 0.1,
        "carbG": 2.8,
        "saltG": 0,
        "fiberG": 1.3,
        "ironMg": 0.5,
        "calciumMg": 24
      },
      "unitGrams": {
        "本": 200
      }
    },
    {
      "id": "06095",
      "label": "大葉",
      "mextName": "しそ 葉 生",
      "aliases": [
        "大葉",
        "しそ",
        "青じそ"
      ],
      "per100g": {
        "kcal": 32,
        "proteinG": 3.9,
        "fatG": 0.1,
        "carbG": 7.5,
        "saltG": 0,
        "fiberG": 7.3,
        "ironMg": 1.7,
        "calciumMg": 230
      },
      "unitGrams": {
        "枚": 1
      }
    },
    {
      "id": "06280",
      "label": "みょうが",
      "mextName": "（みょうが類） みょうが 花穂 生",
      "aliases": [
        "みょうが"
      ],
      "per100g": {
        "kcal": 11,
        "proteinG": 0.9,
        "fatG": 0.1,
        "carbG": 2.6,
        "saltG": 0,
        "fiberG": 2.1,
        "ironMg": 0.5,
        "calciumMg": 25
      },
      "unitGrams": {
        "個": 15
      }
    },
    {
      "id": "06239",
      "label": "パセリ",
      "mextName": "パセリ 葉 生",
      "aliases": [
        "パセリ"
      ],
      "per100g": {
        "kcal": 34,
        "proteinG": 4,
        "fatG": 0.7,
        "carbG": 7.8,
        "saltG": 0,
        "fiberG": 6.8,
        "ironMg": 7.5,
        "calciumMg": 290
      },
      "unitGrams": {
        "枝": 5
      }
    },
    {
      "id": "06172",
      "label": "赤唐辛子",
      "mextName": "とうがらし 果実 乾",
      "aliases": [
        "赤唐辛子",
        "唐辛子",
        "鷹の爪"
      ],
      "per100g": {
        "kcal": 270,
        "proteinG": 14.7,
        "fatG": 12,
        "carbG": 58.4,
        "saltG": 0,
        "fiberG": 46.4,
        "ironMg": 6.8,
        "calciumMg": 74
      },
      "unitGrams": {
        "本": 0.5
      }
    },
    {
      "id": "06180",
      "label": "コーン缶",
      "mextName": "（とうもろこし類） スイートコーン 缶詰 ホールカーネルスタイル",
      "aliases": [
        "コーン缶",
        "コーン",
        "ホールコーン"
      ],
      "per100g": {
        "kcal": 78,
        "proteinG": 2.3,
        "fatG": 0.5,
        "carbG": 17.8,
        "saltG": 0.5,
        "fiberG": 3.3,
        "ironMg": 0.4,
        "calciumMg": 2
      },
      "unitGrams": {
        "缶": 120
      }
    },
    {
      "id": "06015",
      "label": "枝豆",
      "mextName": "えだまめ 生",
      "aliases": [
        "枝豆"
      ],
      "per100g": {
        "kcal": 125,
        "proteinG": 11.7,
        "fatG": 6.2,
        "carbG": 8.8,
        "saltG": 0,
        "fiberG": 5,
        "ironMg": 2.7,
        "calciumMg": 58
      },
      "note": "さや付きで量る場合は約半分が可食部"
    },
    {
      "id": "02006",
      "label": "さつまいも",
      "mextName": "＜いも類＞ （さつまいも類） さつまいも 塊根 皮なし 生",
      "aliases": [
        "さつまいも"
      ],
      "per100g": {
        "kcal": 126,
        "proteinG": 1.2,
        "fatG": 0.2,
        "carbG": 31.9,
        "saltG": 0,
        "fiberG": 2.2,
        "ironMg": 0.6,
        "calciumMg": 36
      },
      "unitGrams": {
        "本": 180
      }
    },
    {
      "id": "02010",
      "label": "里芋",
      "mextName": "＜いも類＞ （さといも類） さといも 球茎 生",
      "aliases": [
        "里芋"
      ],
      "per100g": {
        "kcal": 53,
        "proteinG": 1.5,
        "fatG": 0.1,
        "carbG": 13.1,
        "saltG": 0,
        "fiberG": 2.3,
        "ironMg": 0.5,
        "calciumMg": 10
      },
      "unitGrams": {
        "個": 40
      }
    },
    {
      "id": "02023",
      "label": "長いも",
      "mextName": "＜いも類＞ （やまのいも類） ながいも ながいも 塊根 生",
      "aliases": [
        "長いも",
        "長芋",
        "山芋"
      ],
      "per100g": {
        "kcal": 64,
        "proteinG": 2.2,
        "fatG": 0.3,
        "carbG": 13.9,
        "saltG": 0,
        "fiberG": 1,
        "ironMg": 0.4,
        "calciumMg": 17
      }
    },
    {
      "id": "08039",
      "label": "しいたけ",
      "mextName": "しいたけ 生しいたけ 菌床栽培 生",
      "aliases": [
        "しいたけ",
        "生しいたけ"
      ],
      "per100g": {
        "kcal": 25,
        "proteinG": 3.1,
        "fatG": 0.3,
        "carbG": 6.4,
        "saltG": 0,
        "fiberG": 4.9,
        "ironMg": 0.4,
        "calciumMg": 1
      },
      "unitGrams": {
        "枚": 12,
        "個": 12
      }
    },
    {
      "id": "08013",
      "label": "干ししいたけ",
      "mextName": "しいたけ 乾しいたけ 乾",
      "aliases": [
        "干ししいたけ",
        "乾しいたけ",
        "干し椎茸",
        "乾燥しいたけ"
      ],
      "per100g": {
        "kcal": 258,
        "proteinG": 21.2,
        "fatG": 2.8,
        "carbG": 62.5,
        "saltG": 0,
        "fiberG": 46.7,
        "ironMg": 3.2,
        "calciumMg": 12
      },
      "unitGrams": {
        "枚": 3,
        "個": 3
      }
    },
    {
      "id": "08016",
      "label": "しめじ",
      "mextName": "（しめじ類） ぶなしめじ 生",
      "aliases": [
        "しめじ",
        "ぶなしめじ"
      ],
      "per100g": {
        "kcal": 26,
        "proteinG": 2.7,
        "fatG": 0.5,
        "carbG": 4.8,
        "saltG": 0,
        "fiberG": 3,
        "ironMg": 0.5,
        "calciumMg": 1
      },
      "unitGrams": {
        "袋": 90,
        "パック": 90,
        "株": 90
      }
    },
    {
      "id": "08001",
      "label": "えのき",
      "mextName": "えのきたけ 生",
      "aliases": [
        "えのき"
      ],
      "per100g": {
        "kcal": 34,
        "proteinG": 2.7,
        "fatG": 0.2,
        "carbG": 7.6,
        "saltG": 0,
        "fiberG": 3.9,
        "ironMg": 1.1,
        "calciumMg": 0
      },
      "unitGrams": {
        "袋": 85,
        "株": 85,
        "パック": 85
      }
    },
    {
      "id": "08028",
      "label": "まいたけ",
      "mextName": "まいたけ 生",
      "aliases": [
        "まいたけ"
      ],
      "per100g": {
        "kcal": 22,
        "proteinG": 2,
        "fatG": 0.5,
        "carbG": 4.4,
        "saltG": 0,
        "fiberG": 3.5,
        "ironMg": 0.2,
        "calciumMg": 0
      },
      "unitGrams": {
        "袋": 90,
        "パック": 90,
        "株": 90
      }
    },
    {
      "id": "08025",
      "label": "エリンギ",
      "mextName": "（ひらたけ類） エリンギ 生",
      "aliases": [
        "エリンギ"
      ],
      "per100g": {
        "kcal": 31,
        "proteinG": 2.8,
        "fatG": 0.4,
        "carbG": 6,
        "saltG": 0,
        "fiberG": 3.4,
        "ironMg": 0.3,
        "calciumMg": 0
      },
      "unitGrams": {
        "本": 30,
        "パック": 90
      }
    },
    {
      "id": "11221",
      "label": "鶏もも肉",
      "mextName": "＜鳥肉類＞ にわとり ［若どり・主品目］ もも 皮つき 生",
      "aliases": [
        "鶏もも肉",
        "とりもも"
      ],
      "per100g": {
        "kcal": 190,
        "proteinG": 16.6,
        "fatG": 14.2,
        "carbG": 0,
        "saltG": 0.2,
        "fiberG": 0,
        "ironMg": 0.6,
        "calciumMg": 5
      },
      "unitGrams": {
        "枚": 250
      }
    },
    {
      "id": "11219",
      "label": "鶏むね肉",
      "mextName": "＜鳥肉類＞ にわとり ［若どり・主品目］ むね 皮つき 生",
      "aliases": [
        "鶏むね肉"
      ],
      "per100g": {
        "kcal": 133,
        "proteinG": 21.3,
        "fatG": 5.9,
        "carbG": 0.1,
        "saltG": 0.1,
        "fiberG": 0,
        "ironMg": 0.3,
        "calciumMg": 4
      },
      "unitGrams": {
        "枚": 250
      }
    },
    {
      "id": "11227",
      "label": "鶏ささみ",
      "mextName": "＜鳥肉類＞ にわとり ［若どり・副品目］ ささみ 生",
      "aliases": [
        "鶏ささみ",
        "ささみ",
        "ささ身"
      ],
      "per100g": {
        "kcal": 98,
        "proteinG": 23.9,
        "fatG": 0.8,
        "carbG": 0.1,
        "saltG": 0.1,
        "fiberG": 0,
        "ironMg": 0.3,
        "calciumMg": 4
      },
      "unitGrams": {
        "本": 45
      }
    },
    {
      "id": "11230",
      "label": "鶏ひき肉",
      "mextName": "＜鳥肉類＞ にわとり ［二次品目］ ひき肉 生",
      "aliases": [
        "鶏ひき肉",
        "鶏ミンチ"
      ],
      "per100g": {
        "kcal": 171,
        "proteinG": 17.5,
        "fatG": 12,
        "carbG": 0,
        "saltG": 0.1,
        "fiberG": 0,
        "ironMg": 0.8,
        "calciumMg": 8
      }
    },
    {
      "id": "11285",
      "label": "手羽先",
      "mextName": "＜鳥肉類＞ にわとり ［若どり・主品目］ 手羽さき 皮つき 生",
      "aliases": [
        "手羽先"
      ],
      "per100g": {
        "kcal": 207,
        "proteinG": 17.4,
        "fatG": 16.2,
        "carbG": 0,
        "saltG": 0.2,
        "fiberG": 0,
        "ironMg": 0.6,
        "calciumMg": 20
      },
      "unitGrams": {
        "本": 35
      }
    },
    {
      "id": "11286",
      "label": "手羽元",
      "mextName": "＜鳥肉類＞ にわとり ［若どり・主品目］ 手羽もと 皮つき 生",
      "aliases": [
        "手羽元"
      ],
      "per100g": {
        "kcal": 175,
        "proteinG": 18.2,
        "fatG": 12.8,
        "carbG": 0,
        "saltG": 0.2,
        "fiberG": 0,
        "ironMg": 0.5,
        "calciumMg": 10
      },
      "unitGrams": {
        "本": 40
      }
    },
    {
      "id": "11163",
      "label": "豚ひき肉",
      "mextName": "＜畜肉類＞ ぶた ［ひき肉］ 生",
      "aliases": [
        "豚ひき肉",
        "豚ミンチ"
      ],
      "per100g": {
        "kcal": 209,
        "proteinG": 17.7,
        "fatG": 17.2,
        "carbG": 0.1,
        "saltG": 0.1,
        "fiberG": 0,
        "ironMg": 1,
        "calciumMg": 6
      }
    },
    {
      "id": "11089",
      "label": "牛ひき肉",
      "mextName": "＜畜肉類＞ うし ［ひき肉］ 生",
      "aliases": [
        "牛ひき肉"
      ],
      "per100g": {
        "kcal": 251,
        "proteinG": 17.1,
        "fatG": 21.1,
        "carbG": 0.3,
        "saltG": 0.2,
        "fiberG": 0,
        "ironMg": 2.4,
        "calciumMg": 6
      }
    },
    {
      "id": "11089+11163",
      "label": "合いびき肉",
      "mextName": "＜畜肉類＞ うし ［ひき肉］ 生(0.5) + ＜畜肉類＞ ぶた ［ひき肉］ 生(0.5)",
      "aliases": [
        "合いびき肉",
        "合挽き肉",
        "合い挽き肉",
        "合びき肉"
      ],
      "per100g": {
        "kcal": 230,
        "proteinG": 17.4,
        "fatG": 19.2,
        "carbG": 0.2,
        "saltG": 0.2,
        "fiberG": 0,
        "ironMg": 1.7,
        "calciumMg": 6
      },
      "note": "八訂に合いびき肉の収載が無いため、牛ひき肉と豚ひき肉を半々と仮定した加重平均"
    },
    {
      "id": "11115",
      "label": "豚こま切れ肉",
      "mextName": "＜畜肉類＞ ぶた ［大型種肉］ かた 脂身つき 生",
      "aliases": [
        "豚こま切れ肉",
        "豚こま",
        "豚小間",
        "豚切り落とし"
      ],
      "per100g": {
        "kcal": 201,
        "proteinG": 18.5,
        "fatG": 14.6,
        "carbG": 0.2,
        "saltG": 0.1,
        "fiberG": 0,
        "ironMg": 0.5,
        "calciumMg": 4
      },
      "note": "こま切れは部位混合のため、かた(脂身つき)で代表"
    },
    {
      "id": "11129",
      "label": "豚バラ肉",
      "mextName": "＜畜肉類＞ ぶた ［大型種肉］ ばら 脂身つき 生",
      "aliases": [
        "豚バラ肉",
        "豚バラ薄切り",
        "豚ばら肉",
        "豚バラ"
      ],
      "per100g": {
        "kcal": 366,
        "proteinG": 14.4,
        "fatG": 35.4,
        "carbG": 0.1,
        "saltG": 0.1,
        "fiberG": 0,
        "ironMg": 0.6,
        "calciumMg": 3
      },
      "unitGrams": {
        "枚": 20
      },
      "note": "2026-08-25 便KP: 部位名そのものの「豚バラ」を別名に足した。実データCの『豚バラしゃぶしゃぶ用肉 150g』『豚バラブロック肉 200g』が、書き方ちがいなのに成分表で落ちていた(主材料まるごと)。売り場で「豚バラ◯◯」と付く商品はどれも八訂11129「ばら 脂身つき」なので、部位名で拾えば しゃぶしゃぶ用・ブロック・かたまり・スライス を書き分けずに済む。成分値・目安量は1つも変えていない"
    },
    {
      "id": "11123",
      "label": "豚ロース肉",
      "mextName": "＜畜肉類＞ ぶた ［大型種肉］ ロース 脂身つき 生",
      "aliases": [
        "豚ロース肉",
        "豚ロース薄切り",
        "豚ロース"
      ],
      "per100g": {
        "kcal": 248,
        "proteinG": 19.3,
        "fatG": 19.2,
        "carbG": 0.2,
        "saltG": 0.1,
        "fiberG": 0,
        "ironMg": 0.3,
        "calciumMg": 4
      },
      "unitGrams": {
        "枚": 30
      }
    },
    {
      "id": "11030",
      "label": "牛こま切れ肉",
      "mextName": "＜畜肉類＞ うし ［乳用肥育牛肉］ かた 脂身つき 生",
      "aliases": [
        "牛こま切れ肉",
        "牛こま",
        "牛切り落とし",
        "牛薄切り肉"
      ],
      "per100g": {
        "kcal": 231,
        "proteinG": 17.1,
        "fatG": 19.8,
        "carbG": 0.3,
        "saltG": 0.2,
        "fiberG": 0,
        "ironMg": 2.1,
        "calciumMg": 4
      },
      "note": "こま切れ・部位無指定の「牛薄切り肉」は部位混合のため、かた(脂身つき)で代表"
    },
    {
      "id": "11046",
      "label": "牛バラ肉",
      "mextName": "＜畜肉類＞ うし ［乳用肥育牛肉］ ばら 脂身つき 生",
      "aliases": [
        "牛バラ肉",
        "牛ばら肉"
      ],
      "per100g": {
        "kcal": 381,
        "proteinG": 12.8,
        "fatG": 39.4,
        "carbG": 0.3,
        "saltG": 0.1,
        "fiberG": 0,
        "ironMg": 1.4,
        "calciumMg": 3
      }
    },
    {
      "id": "11176",
      "label": "ハム",
      "mextName": "＜畜肉類＞ ぶた ［ハム類］ ロースハム ロースハム",
      "aliases": [
        "ハム",
        "ロースハム"
      ],
      "per100g": {
        "kcal": 211,
        "proteinG": 18.6,
        "fatG": 14.5,
        "carbG": 2,
        "saltG": 2.3,
        "fiberG": 0,
        "ironMg": 0.5,
        "calciumMg": 4
      },
      "unitGrams": {
        "枚": 10
      }
    },
    {
      "id": "11183",
      "label": "ベーコン",
      "mextName": "＜畜肉類＞ ぶた ［ベーコン類］ ばらベーコン ばらベーコン",
      "aliases": [
        "ベーコン"
      ],
      "per100g": {
        "kcal": 241,
        "proteinG": 15.4,
        "fatG": 19.4,
        "carbG": 3.2,
        "saltG": 2.6,
        "fiberG": 0,
        "ironMg": 0.4,
        "calciumMg": 4
      },
      "unitGrams": {
        "枚": 18
      }
    },
    {
      "id": "11186",
      "label": "ウインナー",
      "mextName": "＜畜肉類＞ ぶた ［ソーセージ類］ ウインナーソーセージ ウインナーソーセージ",
      "aliases": [
        "ウインナー",
        "ウィンナー",
        "ソーセージ"
      ],
      "per100g": {
        "kcal": 319,
        "proteinG": 11.5,
        "fatG": 30.6,
        "carbG": 3.3,
        "saltG": 1.9,
        "fiberG": 0,
        "ironMg": 0.5,
        "calciumMg": 6
      },
      "unitGrams": {
        "本": 20
      }
    },
    {
      "id": "10134",
      "label": "鮭",
      "mextName": "＜魚類＞ （さけ・ます類） しろさけ 生",
      "aliases": [
        "生鮭",
        "鮭切り身"
      ],
      "rawAliases": [
        "鮭",
        "さけ(切り身)",
        "鮭(切り身)"
      ],
      "per100g": {
        "kcal": 124,
        "proteinG": 22.3,
        "fatG": 4.1,
        "carbG": 0.1,
        "saltG": 0.2,
        "fiberG": 0,
        "ironMg": 0.5,
        "calciumMg": 14
      },
      "unitGrams": {
        "切れ": 80
      },
      "note": "「鮭」は正規化すると「酒」と同じ読みになるため rawAliases で対応"
    },
    {
      "id": "10139",
      "label": "塩鮭",
      "mextName": "＜魚類＞ （さけ・ます類） しろさけ 塩ざけ",
      "aliases": [
        "塩鮭",
        "塩ざけ",
        "塩さけ",
        "甘塩鮭",
        "甘塩さけ",
        "甘塩ざけ"
      ],
      "per100g": {
        "kcal": 183,
        "proteinG": 22.4,
        "fatG": 11.1,
        "carbG": 0.1,
        "saltG": 1.8,
        "fiberG": 0,
        "ironMg": 0.3,
        "calciumMg": 16
      },
      "unitGrams": {
        "切れ": 80
      },
      "note": "2026-08-23 便KF: 実データ「レンジで簡単 鮭のちゃんちゃん焼き風」の『塩鮭 2切れ』が成分データ無しで丸ごと落ち、主菜なのに1人分72kcal・たんぱく質4.8gになっていた。八訂に「しろさけ 塩ざけ」(10139)が収載されているのでそれを当てる。生の鮭(10134・食塩相当量0.2g/100g)で代表してはいけない(塩ざけは1.8g/100g＝切り身1切れ80gで約1.4g。減塩の判断では9倍の差になる)。1切れ80gは生鮭と同じ代表値"
    },
    {
      "id": "10154",
      "label": "さば",
      "mextName": "＜魚類＞ （さば類） まさば 生",
      "aliases": [
        "さば",
        "鯖"
      ],
      "per100g": {
        "kcal": 211,
        "proteinG": 20.6,
        "fatG": 16.8,
        "carbG": 0.3,
        "saltG": 0.3,
        "fiberG": 0,
        "ironMg": 1.2,
        "calciumMg": 6
      },
      "unitGrams": {
        "切れ": 80
      }
    },
    {
      "id": "10205",
      "label": "たら",
      "mextName": "＜魚類＞ （たら類） まだら 生",
      "aliases": [
        "たら",
        "鱈",
        "生だら"
      ],
      "per100g": {
        "kcal": 72,
        "proteinG": 17.6,
        "fatG": 0.2,
        "carbG": 0.1,
        "saltG": 0.3,
        "fiberG": 0,
        "ironMg": 0.2,
        "calciumMg": 32
      },
      "unitGrams": {
        "切れ": 80
      }
    },
    {
      "id": "10171",
      "label": "さわら",
      "mextName": "＜魚類＞ さわら 生",
      "aliases": [
        "さわら"
      ],
      "per100g": {
        "kcal": 161,
        "proteinG": 20.1,
        "fatG": 9.7,
        "carbG": 0.1,
        "saltG": 0.2,
        "fiberG": 0,
        "ironMg": 0.8,
        "calciumMg": 13
      },
      "unitGrams": {
        "切れ": 80
      },
      "note": "「さわら(切り身)」の名寄せ対応(2026-07-21・栄養カバレッジ監査で追加)"
    },
    {
      "id": "10241",
      "label": "ぶり",
      "mextName": "＜魚類＞ ぶり 成魚 生",
      "aliases": [
        "ぶり",
        "鰤"
      ],
      "per100g": {
        "kcal": 222,
        "proteinG": 21.4,
        "fatG": 17.6,
        "carbG": 0.3,
        "saltG": 0.1,
        "fiberG": 0,
        "ironMg": 1.3,
        "calciumMg": 5
      },
      "unitGrams": {
        "切れ": 80
      }
    },
    {
      "id": "10173",
      "label": "さんま",
      "mextName": "＜魚類＞ さんま 皮つき 生",
      "aliases": [
        "さんま",
        "秋刀魚"
      ],
      "per100g": {
        "kcal": 287,
        "proteinG": 18.1,
        "fatG": 25.6,
        "carbG": 0.1,
        "saltG": 0.4,
        "fiberG": 0,
        "ironMg": 1.4,
        "calciumMg": 28
      },
      "unitGrams": {
        "尾": 100
      },
      "note": "下処理済み(頭・内臓を除いた)可食部の代表値。1尾約100g"
    },
    {
      "id": "10415",
      "label": "えび",
      "mextName": "＜えび・かに類＞ （えび類） バナメイえび 養殖 生",
      "aliases": [
        "えび",
        "むきえび",
        "バナメイえび"
      ],
      "per100g": {
        "kcal": 82,
        "proteinG": 19.6,
        "fatG": 0.6,
        "carbG": 0.7,
        "saltG": 0.3,
        "fiberG": 0,
        "ironMg": 1.4,
        "calciumMg": 68
      },
      "unitGrams": {
        "尾": 10
      }
    },
    {
      "id": "10345",
      "label": "いか",
      "mextName": "＜いか・たこ類＞ （いか類） するめいか 生",
      "aliases": [
        "いか",
        "するめいか"
      ],
      "per100g": {
        "kcal": 76,
        "proteinG": 17.9,
        "fatG": 0.8,
        "carbG": 0.1,
        "saltG": 0.5,
        "fiberG": 0,
        "ironMg": 0.1,
        "calciumMg": 11
      },
      "unitGrams": {
        "杯": 210
      }
    },
    {
      "id": "10281",
      "label": "あさり",
      "mextName": "＜貝類＞ あさり 生",
      "aliases": [
        "あさり"
      ],
      "per100g": {
        "kcal": 29,
        "proteinG": 5.7,
        "fatG": 0.7,
        "carbG": 0.4,
        "saltG": 2,
        "fiberG": 0,
        "ironMg": 2.2,
        "calciumMg": 66
      },
      "note": "むき身(殻なし)のグラム数で計算すること(八訂10281は廃棄率70%=殻付き重量の3割が可食部)。2026-07-21分量表記拡充: 「1パック」「1袋」等の包装単位はunitGrams未対応のまま(意図的な保留)。理由は2つの不確実性が重なるため: ①スーパーの生あさり1パックの実測内容量は150〜420g程度と商品により幅が大きく単一の代表値を決めがたい(2026-07-21 WebSearchで確認) ②殻付き重量から可食部への換算にも廃棄率70%の適用が必要で、①と②を両方仮定した値は誤差が大きく「捏造禁止」の方針に反すると判断。缶詰(水煮・むき身のみで廃棄率0%)は下記「あさり水煮缶」を別食品として追加済み"
    },
    {
      "id": "10313",
      "label": "ほたて",
      "mextName": "＜貝類＞ ほたてがい 貝柱 生",
      "aliases": [
        "ほたて",
        "ほたて貝柱"
      ],
      "per100g": {
        "kcal": 82,
        "proteinG": 16.9,
        "fatG": 0.3,
        "carbG": 3.5,
        "saltG": 0.3,
        "fiberG": 0,
        "ironMg": 0.2,
        "calciumMg": 7
      },
      "unitGrams": {
        "個": 30
      }
    },
    {
      "id": "10164",
      "label": "サバ水煮缶",
      "mextName": "＜魚類＞ （さば類） 缶詰 水煮",
      "aliases": [
        "サバ水煮缶",
        "さば缶",
        "鯖缶"
      ],
      "per100g": {
        "kcal": 174,
        "proteinG": 20.9,
        "fatG": 10.7,
        "carbG": 0.2,
        "saltG": 0.9,
        "fiberG": 0,
        "ironMg": 1.6,
        "calciumMg": 260
      },
      "unitGrams": {
        "缶": 190
      }
    },
    {
      "id": "10263",
      "label": "ツナ缶（油漬け）",
      "mextName": "＜魚類＞ （まぐろ類） 缶詰 油漬 フレーク ライト",
      "aliases": [
        "ツナ缶",
        "ツナ"
      ],
      "per100g": {
        "kcal": 265,
        "proteinG": 17.7,
        "fatG": 21.7,
        "carbG": 0.1,
        "saltG": 0.9,
        "fiberG": 0,
        "ironMg": 0.5,
        "calciumMg": 4
      },
      "unitGrams": {
        "缶": 70
      }
    },
    {
      "id": "10260",
      "label": "ツナ缶（水煮）",
      "mextName": "＜魚類＞ （まぐろ類） 缶詰 水煮 フレーク ライト",
      "aliases": [
        "ツナ水煮缶",
        "ノンオイルツナ",
        "ツナ水煮"
      ],
      "per100g": {
        "kcal": 70,
        "proteinG": 16,
        "fatG": 0.7,
        "carbG": 0.2,
        "saltG": 0.5,
        "fiberG": 0,
        "ironMg": 0.6,
        "calciumMg": 5
      },
      "unitGrams": {
        "缶": 70
      },
      "note": "2026-08-25 便KP: 「缶」を付けない「ツナ水煮」を別名に足した(実データCの『ツナ水煮 70g』が成分表でも価格マスタでも落ちていた)。中身は同じ水煮のツナ缶。成分値・目安量は変えていない"
    },
    {
      "id": "10055",
      "label": "しらす",
      "mextName": "＜魚類＞ （いわし類） しらす干し 微乾燥品",
      "aliases": [
        "しらす",
        "しらす干し"
      ],
      "per100g": {
        "kcal": 113,
        "proteinG": 24.5,
        "fatG": 2.1,
        "carbG": 0.1,
        "saltG": 4.2,
        "fiberG": 0,
        "ironMg": 0.6,
        "calciumMg": 280
      },
      "unitGrams": {
        "大さじ": 5
      }
    },
    {
      "id": "10091",
      "label": "かつお節",
      "mextName": "＜魚類＞ （かつお類） 加工品 かつお節",
      "aliases": [
        "かつお節",
        "削り節"
      ],
      "per100g": {
        "kcal": 332,
        "proteinG": 77.1,
        "fatG": 2.9,
        "carbG": 0.8,
        "saltG": 0.3,
        "fiberG": 0,
        "ironMg": 5.5,
        "calciumMg": 28
      },
      "unitGrams": {
        "パック": 3,
        "大さじ": 2,
        "袋": 3
      }
    },
    {
      "id": "10379",
      "label": "かまぼこ",
      "mextName": "＜水産練り製品＞ 蒸しかまぼこ",
      "aliases": [
        "かまぼこ"
      ],
      "per100g": {
        "kcal": 93,
        "proteinG": 12,
        "fatG": 0.9,
        "carbG": 9.7,
        "saltG": 2.5,
        "fiberG": 0,
        "ironMg": 0.3,
        "calciumMg": 25
      },
      "unitGrams": {
        "本": 100
      }
    },
    {
      "id": "10381",
      "label": "ちくわ",
      "mextName": "＜水産練り製品＞ 焼き竹輪",
      "aliases": [
        "ちくわ"
      ],
      "per100g": {
        "kcal": 107,
        "proteinG": 13.2,
        "fatG": 0.4,
        "carbG": 13.3,
        "saltG": 2.5,
        "fiberG": 0,
        "ironMg": 0.2,
        "calciumMg": 48
      },
      "unitGrams": {
        "本": 30
      }
    },
    {
      "id": "10385",
      "label": "はんぺん",
      "mextName": "＜水産練り製品＞ はんぺん",
      "aliases": [
        "はんぺん"
      ],
      "per100g": {
        "kcal": 93,
        "proteinG": 9.9,
        "fatG": 1,
        "carbG": 11.4,
        "saltG": 1.5,
        "fiberG": 0,
        "ironMg": 0.5,
        "calciumMg": 15
      },
      "unitGrams": {
        "枚": 100
      }
    },
    {
      "id": "10386",
      "label": "さつま揚げ",
      "mextName": "＜水産練り製品＞ さつま揚げ",
      "aliases": [
        "さつま揚げ"
      ],
      "per100g": {
        "kcal": 116,
        "proteinG": 11.3,
        "fatG": 2.4,
        "carbG": 12.6,
        "saltG": 2,
        "fiberG": 0,
        "ironMg": 0.1,
        "calciumMg": 20
      },
      "unitGrams": {
        "枚": 60
      }
    },
    {
      "id": "12004",
      "label": "卵",
      "mextName": "鶏卵 全卵 生",
      "aliases": [
        "卵",
        "鶏卵"
      ],
      "per100g": {
        "kcal": 142,
        "proteinG": 12.2,
        "fatG": 10.2,
        "carbG": 0.4,
        "saltG": 0.4,
        "fiberG": 0,
        "ironMg": 1.5,
        "calciumMg": 46
      },
      "unitGrams": {
        "個": 50
      }
    },
    {
      "id": "13003",
      "label": "牛乳",
      "mextName": "＜牛乳及び乳製品＞ （液状乳類） 普通牛乳",
      "aliases": [
        "牛乳"
      ],
      "per100g": {
        "kcal": 61,
        "proteinG": 3.3,
        "fatG": 3.8,
        "carbG": 4.8,
        "saltG": 0.1,
        "fiberG": 0,
        "ironMg": 0,
        "calciumMg": 110
      },
      "gramsPerMl": 1.03
    },
    {
      "id": "13014",
      "label": "生クリーム",
      "mextName": "＜牛乳及び乳製品＞ （クリーム類） クリーム 乳脂肪",
      "aliases": [
        "生クリーム"
      ],
      "per100g": {
        "kcal": 404,
        "proteinG": 1.9,
        "fatG": 43,
        "carbG": 6.5,
        "saltG": 0.1,
        "fiberG": 0,
        "ironMg": 0.1,
        "calciumMg": 49
      },
      "gramsPerMl": 1
    },
    {
      "id": "13025",
      "label": "ヨーグルト",
      "mextName": "＜牛乳及び乳製品＞ （発酵乳・乳酸菌飲料） ヨーグルト 全脂無糖",
      "aliases": [
        "ヨーグルト",
        "プレーンヨーグルト"
      ],
      "per100g": {
        "kcal": 56,
        "proteinG": 3.6,
        "fatG": 3,
        "carbG": 4.9,
        "saltG": 0.1,
        "fiberG": 0,
        "ironMg": 0,
        "calciumMg": 120
      },
      "unitGrams": {
        "パック": 400
      },
      "gramsPerMl": 1
    },
    {
      "id": "13040",
      "label": "チーズ",
      "mextName": "＜牛乳及び乳製品＞ （チーズ類） プロセスチーズ",
      "aliases": [
        "チーズ",
        "プロセスチーズ",
        "スライスチーズ"
      ],
      "per100g": {
        "kcal": 313,
        "proteinG": 22.7,
        "fatG": 26,
        "carbG": 1.3,
        "saltG": 2.8,
        "fiberG": 0,
        "ironMg": 0.3,
        "calciumMg": 630
      },
      "unitGrams": {
        "枚": 18,
        "個": 17
      }
    },
    {
      "id": "14017",
      "label": "バター",
      "mextName": "（バター類） 無発酵バター 有塩バター",
      "aliases": [
        "バター"
      ],
      "per100g": {
        "kcal": 700,
        "proteinG": 0.6,
        "fatG": 81,
        "carbG": 0.2,
        "saltG": 1.9,
        "fiberG": 0,
        "ironMg": 0.1,
        "calciumMg": 15
      },
      "unitGrams": {
        "大さじ": 12,
        "小さじ": 4,
        "かけ": 10
      }
    },
    {
      "id": "04032",
      "label": "木綿豆腐",
      "mextName": "だいず ［豆腐・油揚げ類］ 木綿豆腐",
      "aliases": [
        "木綿豆腐",
        "豆腐"
      ],
      "per100g": {
        "kcal": 73,
        "proteinG": 7,
        "fatG": 4.9,
        "carbG": 1.5,
        "saltG": 0,
        "fiberG": 1.1,
        "ironMg": 1.5,
        "calciumMg": 93
      },
      "unitGrams": {
        "丁": 350
      },
      "note": "「豆腐」とだけ書かれた場合は木綿豆腐で代表"
    },
    {
      "id": "04033",
      "label": "絹ごし豆腐",
      "mextName": "だいず ［豆腐・油揚げ類］ 絹ごし豆腐",
      "aliases": [
        "絹ごし豆腐",
        "絹豆腐"
      ],
      "per100g": {
        "kcal": 56,
        "proteinG": 5.3,
        "fatG": 3.5,
        "carbG": 2,
        "saltG": 0,
        "fiberG": 0.9,
        "ironMg": 1.2,
        "calciumMg": 75
      },
      "unitGrams": {
        "丁": 350
      }
    },
    {
      "id": "04040",
      "label": "油揚げ",
      "mextName": "だいず ［豆腐・油揚げ類］ 油揚げ 生",
      "aliases": [
        "油揚げ",
        "うすあげ"
      ],
      "per100g": {
        "kcal": 377,
        "proteinG": 23.4,
        "fatG": 34.4,
        "carbG": 0.4,
        "saltG": 0,
        "fiberG": 1.3,
        "ironMg": 3.2,
        "calciumMg": 310
      },
      "unitGrams": {
        "枚": 20
      }
    },
    {
      "id": "04051",
      "label": "生おから",
      "mextName": "だいず ［その他］ おから 生",
      "aliases": [
        "生おから",
        "おから"
      ],
      "per100g": {
        "kcal": 88,
        "proteinG": 6.1,
        "fatG": 3.6,
        "carbG": 13.8,
        "saltG": 0,
        "fiberG": 11.5,
        "ironMg": 1.3,
        "calciumMg": 81
      },
      "note": "B4卯の花で初登場(2026-07-10)。「おからパウダー(乾燥)」は別食品なので流用しない"
    },
    {
      "id": "04039",
      "label": "厚揚げ",
      "mextName": "だいず ［豆腐・油揚げ類］ 生揚げ",
      "aliases": [
        "厚揚げ",
        "生揚げ"
      ],
      "per100g": {
        "kcal": 143,
        "proteinG": 10.7,
        "fatG": 11.3,
        "carbG": 0.9,
        "saltG": 0,
        "fiberG": 0.8,
        "ironMg": 2.6,
        "calciumMg": 240
      },
      "unitGrams": {
        "枚": 150,
        "パック": 300,
        "個": 150
      },
      "note": "2026-08-25 便KL: 「パック」「個」を足した。市販の厚揚げは2枚入りパックが標準で、食材価格マスタの厚揚げ(60円/1枚)が根拠に挙げている実売3件——西友「厚揚げ きぬ 2枚入」・ベイシア「木綿厚揚げ 2枚入」・イオン トップバリュ——がいずれも2枚入り。影響範囲テストA「節約したい人」の実データも『厚揚げ 1パック』のメモが「正方形2枚」、別の品が『厚揚げ 二個入りの 1個』と書いていて、1パック=2枚・1個=1枚で一致している。よって パック=枚150g×2枚=300g・個=1枚=150g（新しい重さは作らず、既存の「枚」の代表値の倍数で置く）。直す前は厚揚げが5品で単位を換算できずに落ち、「簡単！厚揚げと小松菜の煮浸し」が1食8円だった"
    },
    {
      "id": "04046",
      "label": "納豆",
      "mextName": "だいず ［納豆類］ 糸引き納豆",
      "aliases": [
        "納豆"
      ],
      "per100g": {
        "kcal": 184,
        "proteinG": 16.5,
        "fatG": 10,
        "carbG": 12.1,
        "saltG": 0,
        "fiberG": 9.5,
        "ironMg": 3.3,
        "calciumMg": 90
      },
      "unitGrams": {
        "パック": 45,
        "個": 45
      }
    },
    {
      "id": "02003",
      "label": "こんにゃく",
      "mextName": "＜いも類＞ こんにゃく 板こんにゃく 精粉こんにゃく",
      "aliases": [
        "こんにゃく"
      ],
      "per100g": {
        "kcal": 5,
        "proteinG": 0.1,
        "fatG": 0,
        "carbG": 2.3,
        "saltG": 0,
        "fiberG": 2.2,
        "ironMg": 0.4,
        "calciumMg": 43
      },
      "unitGrams": {
        "枚": 250,
        "個": 250,
        "丁": 250
      },
      "note": "2026-08-23 便KF: 「個」「丁」を足した。板こんにゃくは1枚＝1丁＝1個で同じもの(市販の板こんにゃく1枚は約250g)を指す言い方の違いでしかないのに、実データの豚汁『こんにゃく 1/2個』が単位を換算できずに落ちていた。重さは既存の「枚」と同じ代表値をそのまま使っている(新しい数値は作っていない)"
    },
    {
      "id": "02005",
      "label": "しらたき",
      "mextName": "＜いも類＞ こんにゃく しらたき",
      "aliases": [
        "しらたき",
        "糸こんにゃく"
      ],
      "per100g": {
        "kcal": 7,
        "proteinG": 0.2,
        "fatG": 0,
        "carbG": 3,
        "saltG": 0,
        "fiberG": 2.9,
        "ironMg": 0.5,
        "calciumMg": 75
      },
      "unitGrams": {
        "袋": 200,
        "パック": 200
      },
      "note": "2026-08-25 便KL: 「パック」を足した。しらたき・糸こんにゃくは1袋＝1パックで、袋詰めのものを「1パック」とも言う同じ包装の言い方ちがい。重さは既存の「袋」の代表値をそのまま使う(新しい数値は作っていない)。影響範囲テストAの『糸こんにゃく 2パック』が単位を換算できずに落ちていた"
    },
    {
      "id": "01088",
      "label": "ご飯",
      "mextName": "こめ ［水稲めし］ 精白米 うるち米",
      "aliases": [
        "ご飯",
        "白ご飯",
        "白飯",
        "温かいご飯"
      ],
      "per100g": {
        "kcal": 156,
        "proteinG": 2.5,
        "fatG": 0.3,
        "carbG": 37.1,
        "saltG": 0,
        "fiberG": 1.5,
        "ironMg": 0.1,
        "calciumMg": 3
      },
      "unitGrams": {
        "杯": 150,
        "膳": 150,
        "杯分": 150
      }
    },
    {
      "id": "01083",
      "label": "米",
      "mextName": "こめ ［水稲穀粒］ 精白米 うるち米",
      "aliases": [
        "米",
        "精白米",
        "白米"
      ],
      "per100g": {
        "kcal": 342,
        "proteinG": 6.1,
        "fatG": 0.9,
        "carbG": 77.6,
        "saltG": 0,
        "fiberG": 0.5,
        "ironMg": 0.8,
        "calciumMg": 5
      },
      "unitGrams": {
        "合": 150
      }
    },
    {
      "id": "01026",
      "label": "食パン",
      "mextName": "こむぎ ［パン類］ 角形食パン 食パン",
      "aliases": [
        "食パン",
        "パン"
      ],
      "per100g": {
        "kcal": 248,
        "proteinG": 8.9,
        "fatG": 4.1,
        "carbG": 46.4,
        "saltG": 1.2,
        "fiberG": 4.2,
        "ironMg": 0.5,
        "calciumMg": 22
      },
      "unitGrams": {
        "枚": 60,
        "斤": 360
      },
      "note": "1枚=6枚切りの目安"
    },
    {
      "id": "01034",
      "label": "ロールパン",
      "mextName": "こむぎ ［パン類］ ロールパン",
      "aliases": [
        "ロールパン"
      ],
      "per100g": {
        "kcal": 309,
        "proteinG": 10.1,
        "fatG": 9,
        "carbG": 48.6,
        "saltG": 1.2,
        "fiberG": 2,
        "ironMg": 0.7,
        "calciumMg": 44
      },
      "unitGrams": {
        "個": 30
      }
    },
    {
      "id": "01015",
      "label": "小麦粉",
      "mextName": "こむぎ ［小麦粉］ 薄力粉 1等",
      "aliases": [
        "小麦粉",
        "薄力粉"
      ],
      "per100g": {
        "kcal": 349,
        "proteinG": 8.3,
        "fatG": 1.5,
        "carbG": 75.8,
        "saltG": 0,
        "fiberG": 2.5,
        "ironMg": 0.5,
        "calciumMg": 20
      },
      "unitGrams": {
        "大さじ": 9,
        "小さじ": 3,
        "カップ": 110
      }
    },
    {
      "id": "01020",
      "label": "強力粉",
      "mextName": "こむぎ ［小麦粉］ 強力粉 1等",
      "aliases": [
        "強力粉"
      ],
      "per100g": {
        "kcal": 337,
        "proteinG": 11.8,
        "fatG": 1.5,
        "carbG": 71.7,
        "saltG": 0,
        "fiberG": 2.7,
        "ironMg": 0.9,
        "calciumMg": 17
      },
      "unitGrams": {
        "大さじ": 9,
        "小さじ": 3,
        "カップ": 110
      }
    },
    {
      "id": "02034",
      "label": "片栗粉",
      "mextName": "＜でん粉・でん粉製品＞ （でん粉類） じゃがいもでん粉",
      "aliases": [
        "片栗粉"
      ],
      "per100g": {
        "kcal": 338,
        "proteinG": 0.1,
        "fatG": 0.1,
        "carbG": 81.6,
        "saltG": 0,
        "fiberG": 0,
        "ironMg": 0.6,
        "calciumMg": 10
      },
      "unitGrams": {
        "大さじ": 9,
        "小さじ": 3
      }
    },
    {
      "id": "01079",
      "label": "パン粉",
      "mextName": "こむぎ ［その他］ パン粉 乾燥",
      "aliases": [
        "パン粉"
      ],
      "per100g": {
        "kcal": 349,
        "proteinG": 14.9,
        "fatG": 4.1,
        "carbG": 67.4,
        "saltG": 1.4,
        "fiberG": 6.5,
        "ironMg": 1.1,
        "calciumMg": 25
      },
      "unitGrams": {
        "大さじ": 3,
        "カップ": 40
      }
    },
    {
      "id": "01039",
      "label": "うどん",
      "mextName": "こむぎ ［うどん・そうめん類］ うどん ゆで",
      "aliases": [
        "うどん",
        "ゆでうどん"
      ],
      "per100g": {
        "kcal": 95,
        "proteinG": 2.6,
        "fatG": 0.4,
        "carbG": 21.6,
        "saltG": 0.3,
        "fiberG": 1.3,
        "ironMg": 0.2,
        "calciumMg": 6
      },
      "unitGrams": {
        "玉": 200
      }
    },
    {
      "id": "01044",
      "label": "そうめん",
      "mextName": "こむぎ ［うどん・そうめん類］ そうめん・ひやむぎ ゆで",
      "aliases": [
        "そうめん",
        "ひやむぎ"
      ],
      "per100g": {
        "kcal": 114,
        "proteinG": 3.5,
        "fatG": 0.4,
        "carbG": 25.8,
        "saltG": 0.2,
        "fiberG": 0.9,
        "ironMg": 0.2,
        "calciumMg": 6
      },
      "unitGrams": {
        "束": 135
      },
      "note": "乾1束50g→ゆで約135gの換算。乾(01043)基準だと練り込み塩(3.8g/100g)が茹でこぼし分まで計上され塩分過大になるためゆで基準(2026-07-11)"
    },
    {
      "id": "01047",
      "label": "中華麺",
      "mextName": "こむぎ ［中華めん類］ 中華めん 生",
      "aliases": [
        "中華麺",
        "中華めん"
      ],
      "per100g": {
        "kcal": 249,
        "proteinG": 8.6,
        "fatG": 1.2,
        "carbG": 55.7,
        "saltG": 1,
        "fiberG": 5.4,
        "ironMg": 0.5,
        "calciumMg": 21
      },
      "unitGrams": {
        "玉": 120
      }
    },
    {
      "id": "01049",
      "label": "焼きそば麺",
      "mextName": "こむぎ ［中華めん類］ 蒸し中華めん 蒸し中華めん",
      "aliases": [
        "焼きそば麺",
        "蒸し中華めん",
        "蒸し麺"
      ],
      "per100g": {
        "kcal": 162,
        "proteinG": 4.9,
        "fatG": 1.7,
        "carbG": 35.6,
        "saltG": 0.3,
        "fiberG": 3.1,
        "ironMg": 0.4,
        "calciumMg": 10
      },
      "unitGrams": {
        "玉": 150
      }
    },
    {
      "id": "01063",
      "label": "スパゲッティ",
      "mextName": "こむぎ ［マカロニ・スパゲッティ類］ マカロニ・スパゲッティ 乾",
      "aliases": [
        "スパゲッティ",
        "スパゲティ",
        "パスタ",
        "マカロニ"
      ],
      "per100g": {
        "kcal": 347,
        "proteinG": 12.9,
        "fatG": 1.8,
        "carbG": 73.1,
        "saltG": 0,
        "fiberG": 5.4,
        "ironMg": 1.4,
        "calciumMg": 18
      }
    },
    {
      "id": "01074",
      "label": "餃子の皮",
      "mextName": "こむぎ ［その他］ ぎょうざの皮 生",
      "aliases": [
        "餃子の皮"
      ],
      "per100g": {
        "kcal": 275,
        "proteinG": 9.3,
        "fatG": 1.4,
        "carbG": 57,
        "saltG": 0,
        "fiberG": 2.2,
        "ironMg": 0.8,
        "calciumMg": 16
      },
      "unitGrams": {
        "枚": 6
      }
    },
    {
      "id": "02040",
      "label": "春雨",
      "mextName": "＜でん粉・でん粉製品＞ （でん粉製品） はるさめ 普通はるさめ 乾",
      "aliases": [
        "春雨"
      ],
      "per100g": {
        "kcal": 346,
        "proteinG": 0,
        "fatG": 0.2,
        "carbG": 86.6,
        "saltG": 0,
        "fiberG": 1.2,
        "ironMg": 0.4,
        "calciumMg": 41
      }
    },
    {
      "id": "01004",
      "label": "オートミール",
      "mextName": "えんばく オートミール",
      "aliases": [
        "オートミール"
      ],
      "per100g": {
        "kcal": 350,
        "proteinG": 13.7,
        "fatG": 5.7,
        "carbG": 69.1,
        "saltG": 0,
        "fiberG": 9.4,
        "ironMg": 3.9,
        "calciumMg": 47
      },
      "unitGrams": {
        "大さじ": 6,
        "カップ": 80
      }
    },
    {
      "id": "09044",
      "label": "乾燥わかめ",
      "mextName": "わかめ カットわかめ 乾",
      "aliases": [
        "乾燥わかめ",
        "カットわかめ"
      ],
      "per100g": {
        "kcal": 186,
        "proteinG": 17.9,
        "fatG": 4,
        "carbG": 42.1,
        "saltG": 23.5,
        "fiberG": 39.2,
        "ironMg": 6.5,
        "calciumMg": 870
      },
      "unitGrams": {
        "大さじ": 3,
        "小さじ": 1
      },
      "note": "乾燥品の値。生わかめ・塩蔵わかめには使わない"
    },
    {
      "id": "09002",
      "label": "青のり",
      "mextName": "あおのり 素干し",
      "aliases": [
        "青のり"
      ],
      "per100g": {
        "kcal": 249,
        "proteinG": 29.4,
        "fatG": 5.2,
        "carbG": 41,
        "saltG": 8.1,
        "fiberG": 35.2,
        "ironMg": 77,
        "calciumMg": 750
      },
      "unitGrams": {
        "大さじ": 2,
        "小さじ": 1
      }
    },
    {
      "id": "09004",
      "label": "焼きのり",
      "mextName": "あまのり 焼きのり",
      "aliases": [
        "焼きのり",
        "海苔",
        "刻みのり"
      ],
      "per100g": {
        "kcal": 297,
        "proteinG": 41.4,
        "fatG": 3.7,
        "carbG": 44.3,
        "saltG": 1.3,
        "fiberG": 36,
        "ironMg": 11,
        "calciumMg": 280
      },
      "unitGrams": {
        "枚": 3
      }
    },
    {
      "id": "09017",
      "label": "昆布",
      "mextName": "（こんぶ類） まこんぶ 素干し 乾",
      "aliases": [
        "昆布",
        "だし昆布"
      ],
      "per100g": {
        "kcal": 170,
        "proteinG": 5.8,
        "fatG": 1.3,
        "carbG": 64.3,
        "saltG": 6.6,
        "fiberG": 32.1,
        "ironMg": 3.2,
        "calciumMg": 780
      },
      "unitGrams": {
        "枚": 10
      }
    },
    {
      "id": "09022",
      "label": "塩昆布",
      "mextName": "（こんぶ類） 塩昆布",
      "aliases": [
        "塩昆布"
      ],
      "per100g": {
        "kcal": 193,
        "proteinG": 16.9,
        "fatG": 0.4,
        "carbG": 37,
        "saltG": 18,
        "fiberG": 13.1,
        "ironMg": 4.2,
        "calciumMg": 280
      },
      "note": "つくだ煮の味付け昆布。「塩昆布」を素干し昆布(09017・食塩相当量6.6g/100g)への部分一致に流すと食塩相当量を大きく過小評価するため、八訂09022「塩昆布」を専用食品として分離(2026-07-23 オーナー実機報告。塩昆布3g≒食塩相当量0.5g相当)"
    },
    {
      "id": "09050",
      "label": "ひじき",
      "mextName": "ひじき ほしひじき ステンレス釜 乾",
      "aliases": [
        "ひじき",
        "芽ひじき",
        "乾燥芽ひじき"
      ],
      "per100g": {
        "kcal": 180,
        "proteinG": 9.2,
        "fatG": 3.2,
        "carbG": 58.4,
        "saltG": 4.7,
        "fiberG": 51.8,
        "ironMg": 6.2,
        "calciumMg": 1000
      },
      "unitGrams": {
        "大さじ": 3
      },
      "note": "2026-08-25 便KP: 価格マスタの項目名と同じ「乾燥芽ひじき」を別名に足した。原価側は「成分表の食品名を経由して価格マスタを引き直す」作りなので、成分表がマスタと同じ書き方を持っていないと『乾燥ひじき 15g』『長ひじき 30g』が価格なしのまま落ちる(実データB・Cで3行)。八訂は芽ひじき/長ひじきを分けずに「ほしひじき」で1つなので、どちらもこの1件に寄る。成分値は変えていない"
    },
    {
      "id": "17007",
      "label": "しょうゆ",
      "mextName": "＜調味料類＞ （しょうゆ類） こいくちしょうゆ",
      "aliases": [
        "しょうゆ",
        "濃口醤油",
        "しょう油",
        "濃口しょう油"
      ],
      "per100g": {
        "kcal": 76,
        "proteinG": 7.7,
        "fatG": 0,
        "carbG": 7.9,
        "saltG": 14.5,
        "fiberG": 0,
        "ironMg": 1.7,
        "calciumMg": 29
      },
      "gramsPerMl": 1.2,
      "note": "2026-08-23 便KF: 「しょう油」(かなと漢字の混ぜ書き)を別名に足した。読み仮名辞書では「油」が「あぶら」になるため名寄せできず、影響範囲テストC「時短の人」の豚バラ大根で『しょう油 大さじ2』(食塩相当量約5.2g)が丸ごと落ち、1人分の塩分が0.15gと表示されていた"
    },
    {
      "id": "17008",
      "label": "薄口しょうゆ",
      "mextName": "＜調味料類＞ （しょうゆ類） うすくちしょうゆ",
      "aliases": [
        "薄口しょうゆ",
        "薄口醤油",
        "薄口しょう油"
      ],
      "per100g": {
        "kcal": 60,
        "proteinG": 5.7,
        "fatG": 0,
        "carbG": 5.8,
        "saltG": 16,
        "fiberG": 0,
        "ironMg": 1.1,
        "calciumMg": 24
      },
      "gramsPerMl": 1.2
    },
    {
      "id": "17086",
      "label": "減塩しょうゆ",
      "mextName": "＜調味料類＞ （しょうゆ類） こいくちしょうゆ 減塩",
      "aliases": [
        "減塩しょうゆ",
        "減塩醤油",
        "減塩しょう油",
        "塩分カットしょうゆ",
        "塩分カット醤油",
        "減塩タイプのしょうゆ"
      ],
      "per100g": {
        "kcal": 68,
        "proteinG": 8.1,
        "fatG": 0,
        "carbG": 9,
        "saltG": 8.3,
        "fiberG": 0,
        "ironMg": 2.1,
        "calciumMg": 31
      },
      "gramsPerMl": 1.2,
      "note": "2026-08-25 便KL・司令部裁定で追加。八訂に「こいくちしょうゆ 減塩」(17086)が実収載されており、食塩相当量は普通のこいくちしょうゆ(17007)の14.5g/100gに対して8.3g/100g。直す前は「減塩しょうゆ」が3文字以上の部分一致で普通のしょうゆに流れており、減塩しょうゆを使う人の食塩相当量が約1.7倍で出ていた(多めに出るので減塩の判断を甘くはしないが、数字そのものが違う)。gramsPerMlは普通のしょうゆと同じ1.2(しょうゆ類の概算密度。八訂は密度を収載していないので、同じ流儀の値をそのまま使う)。「減塩」と書いていないしょうゆは、完全一致が部分一致より先に当たるので巻き込まない"
    },
    {
      "id": "17045",
      "label": "味噌",
      "mextName": "＜調味料類＞ （みそ類） 米みそ 淡色辛みそ",
      "aliases": [
        "味噌",
        "合わせ味噌",
        "信州味噌"
      ],
      "per100g": {
        "kcal": 182,
        "proteinG": 12.5,
        "fatG": 6,
        "carbG": 21.9,
        "saltG": 12.4,
        "fiberG": 4.9,
        "ironMg": 4,
        "calciumMg": 100
      },
      "unitGrams": {
        "大さじ": 18,
        "小さじ": 6
      },
      "note": "「味噌」とだけ書かれた場合は淡色辛みそで代表"
    },
    {
      "id": "17044",
      "label": "白味噌",
      "mextName": "＜調味料類＞ （みそ類） 米みそ 甘みそ",
      "aliases": [
        "白味噌",
        "甘みそ",
        "白みそ"
      ],
      "per100g": {
        "kcal": 206,
        "proteinG": 9.7,
        "fatG": 3,
        "carbG": 37.9,
        "saltG": 6.1,
        "fiberG": 5.6,
        "ironMg": 3.4,
        "calciumMg": 80
      },
      "unitGrams": {
        "大さじ": 18,
        "小さじ": 6
      }
    },
    {
      "id": "17046",
      "label": "赤味噌",
      "mextName": "＜調味料類＞ （みそ類） 米みそ 赤色辛みそ",
      "aliases": [
        "赤味噌"
      ],
      "per100g": {
        "kcal": 178,
        "proteinG": 13.1,
        "fatG": 5.5,
        "carbG": 21.1,
        "saltG": 13,
        "fiberG": 4.1,
        "ironMg": 4.3,
        "calciumMg": 130
      },
      "unitGrams": {
        "大さじ": 18,
        "小さじ": 6
      }
    },
    {
      "id": "17119",
      "label": "減塩みそ",
      "mextName": "＜調味料類＞ （みそ類） 減塩みそ",
      "aliases": [
        "減塩みそ",
        "減塩味噌",
        "塩分カットみそ",
        "塩分カット味噌"
      ],
      "per100g": {
        "kcal": 190,
        "proteinG": 11,
        "fatG": 5.9,
        "carbG": 25.7,
        "saltG": 10.7,
        "fiberG": 4.3,
        "ironMg": 1.7,
        "calciumMg": 62
      },
      "unitGrams": {
        "大さじ": 18,
        "小さじ": 6
      },
      "note": "2026-08-25 便KL・司令部裁定で追加。八訂に「減塩みそ」(17119)が実収載されており、食塩相当量は「味噌」として代表に使っている米みそ 淡色辛みそ(17045)の12.4g/100gに対して10.7g/100g。直す前は「減塩みそ」が部分一致で普通の味噌に流れていた。大さじ/小さじの重さは他のみそ類と同じ 大さじ18g/小さじ6g をそのまま使う(新しい数値は作っていない)。「減塩」と書いていないみそは、完全一致が部分一致より先に当たるので巻き込まない"
    },
    {
      "id": "03003",
      "label": "砂糖",
      "mextName": "（砂糖類） 車糖 上白糖",
      "aliases": [
        "砂糖",
        "上白糖",
        "グラニュー糖"
      ],
      "per100g": {
        "kcal": 391,
        "proteinG": 0,
        "fatG": 0,
        "carbG": 99.3,
        "saltG": 0,
        "fiberG": 0,
        "ironMg": 0,
        "calciumMg": 1
      },
      "unitGrams": {
        "大さじ": 9,
        "小さじ": 3,
        "カップ": 130
      }
    },
    {
      "id": "03004",
      "label": "三温糖",
      "mextName": "（砂糖類） 車糖 三温糖",
      "aliases": [
        "三温糖"
      ],
      "per100g": {
        "kcal": 390,
        "proteinG": 0,
        "fatG": 0,
        "carbG": 99,
        "saltG": 0,
        "fiberG": 0,
        "ironMg": 0.1,
        "calciumMg": 6
      },
      "unitGrams": {
        "大さじ": 9,
        "小さじ": 3,
        "カップ": 130
      },
      "note": "2026-08-25 便KP: 実データAの『三温糖 小さじ1/2』が成分表に無くて落ちていた。八訂は上白糖(03003)と同じ「車糖」の並びに03004「三温糖」を実収載している。大さじ9g/小さじ3g/カップ130gは上白糖と同じ値をそのまま使う(同じ車糖で粒の詰まり方が同じため。新しい重さは作っていない)"
    },
    {
      "id": "17012",
      "label": "塩",
      "mextName": "＜調味料類＞ （食塩類） 食塩",
      "aliases": [
        "塩",
        "食塩",
        "塩こしょう",
        "ほんじお"
      ],
      "per100g": {
        "kcal": 0,
        "proteinG": 0,
        "fatG": 0,
        "carbG": 0,
        "saltG": 99.5,
        "fiberG": 0,
        "ironMg": 0,
        "calciumMg": 22
      },
      "unitGrams": {
        "大さじ": 18,
        "小さじ": 6
      },
      "note": "「塩こしょう」は主成分の塩で代表(こしょう分はごく少量のため)。2026-08-25 便KP: 商品名の「ほんじお」を別名に足した(実データBの『「瀬戸のほんじお®」 少々』が落ちていた)。中身は食塩そのもの。だしの素が商品名「ほんだし」を別名に持っているのと同じ扱い"
    },
    {
      "id": "16001",
      "label": "酒",
      "mextName": "＜アルコール飲料類＞ （醸造酒類） 清酒 普通酒",
      "aliases": [
        "酒",
        "料理酒",
        "日本酒"
      ],
      "per100g": {
        "kcal": 107,
        "proteinG": 0.4,
        "fatG": 0,
        "carbG": 4.9,
        "saltG": 0,
        "fiberG": 0,
        "ironMg": 0,
        "calciumMg": 3
      },
      "gramsPerMl": 1
    },
    {
      "id": "16025",
      "label": "みりん",
      "mextName": "＜アルコール飲料類＞ （混成酒類） みりん 本みりん",
      "aliases": [
        "みりん",
        "本みりん"
      ],
      "per100g": {
        "kcal": 241,
        "proteinG": 0.3,
        "fatG": 0,
        "carbG": 43.2,
        "saltG": 0,
        "fiberG": 0,
        "ironMg": 0,
        "calciumMg": 2
      },
      "gramsPerMl": 1.2
    },
    {
      "id": "17054",
      "label": "みりん風調味料",
      "mextName": "＜調味料類＞ （その他） みりん風調味料",
      "aliases": [
        "みりん風調味料"
      ],
      "per100g": {
        "kcal": 225,
        "proteinG": 0.1,
        "fatG": 0,
        "carbG": 55.7,
        "saltG": 0.2,
        "fiberG": 0,
        "ironMg": 0.1,
        "calciumMg": 0
      },
      "gramsPerMl": 1.2
    },
    {
      "id": "17015",
      "label": "酢",
      "mextName": "＜調味料類＞ （食酢類） 穀物酢",
      "aliases": [
        "酢",
        "穀物酢"
      ],
      "per100g": {
        "kcal": 25,
        "proteinG": 0.1,
        "fatG": 0,
        "carbG": 2.4,
        "saltG": 0,
        "fiberG": 0,
        "ironMg": 0,
        "calciumMg": 2
      },
      "gramsPerMl": 1
    },
    {
      "id": "17016",
      "label": "米酢",
      "mextName": "＜調味料類＞ （食酢類） 米酢",
      "aliases": [
        "米酢"
      ],
      "per100g": {
        "kcal": 46,
        "proteinG": 0.2,
        "fatG": 0,
        "carbG": 7.4,
        "saltG": 0,
        "fiberG": 0,
        "ironMg": 0.1,
        "calciumMg": 2
      },
      "gramsPerMl": 1
    },
    {
      "id": "17017",
      "label": "ワインビネガー",
      "mextName": "＜調味料類＞ （食酢類） 果実酢 ぶどう酢",
      "aliases": [
        "ワインビネガー",
        "白ワインビネガー",
        "赤ワインビネガー",
        "ぶどう酢"
      ],
      "per100g": {
        "kcal": 22,
        "proteinG": 0.1,
        "fatG": 0,
        "carbG": 1.2,
        "saltG": 0,
        "fiberG": 0,
        "ironMg": 0.2,
        "calciumMg": 3
      },
      "gramsPerMl": 1,
      "note": "2026-08-23 便KF。ワインビネガーはぶどうから作る果実酢そのもので、八訂の「果実酢 ぶどう酢」(17017)が同じもの。実データ「キノコのマリネサラダ」で『白ワインビネガー 大さじ2』が成分データ無しで落ちていた"
    },
    {
      "id": "14006",
      "label": "サラダ油",
      "mextName": "（植物油脂類） 調合油",
      "aliases": [
        "サラダ油",
        "植物油",
        "揚げ油",
        "炒め油"
      ],
      "rawAliases": [
        "油"
      ],
      "per100g": {
        "kcal": 886,
        "proteinG": 0,
        "fatG": 100,
        "carbG": 0,
        "saltG": 0,
        "fiberG": 0,
        "ironMg": 0,
        "calciumMg": 0
      },
      "gramsPerMl": 0.8,
      "note": "大さじ1=12gの慣用値に合わせて0.8g/ml。「揚げ油」も同じ植物油で代表(2026-07-13追加)。分量が「適量」の油は matchAssumedGrams が約3g/食として計算に含める(2026-07-28 便BY で記述を更新。「計算には反映されない」という以前の注記は、OIL_NAMESに「あげあぶら」が入った時点で実態と食い違っていた)"
    },
    {
      "id": "14002",
      "label": "ごま油",
      "mextName": "（植物油脂類） ごま油",
      "aliases": [
        "ごま油"
      ],
      "per100g": {
        "kcal": 890,
        "proteinG": 0,
        "fatG": 100,
        "carbG": 0,
        "saltG": 0,
        "fiberG": 0,
        "ironMg": 0.1,
        "calciumMg": 1
      },
      "gramsPerMl": 0.8
    },
    {
      "id": "14001",
      "label": "オリーブオイル",
      "mextName": "（植物油脂類） オリーブ油",
      "aliases": [
        "オリーブオイル",
        "オリーブ油"
      ],
      "per100g": {
        "kcal": 894,
        "proteinG": 0,
        "fatG": 100,
        "carbG": 0,
        "saltG": 0,
        "fiberG": 0,
        "ironMg": 0,
        "calciumMg": 0
      },
      "gramsPerMl": 0.8
    },
    {
      "id": "14003",
      "label": "米油",
      "mextName": "（植物油脂類） 米ぬか油",
      "aliases": [
        "米油",
        "こめ油",
        "米ぬか油"
      ],
      "per100g": {
        "kcal": 880,
        "proteinG": 0,
        "fatG": 100,
        "carbG": 0,
        "saltG": 0,
        "fiberG": 0,
        "ironMg": 0,
        "calciumMg": 0
      },
      "gramsPerMl": 0.8,
      "note": "2026-08-25 便KP: 実データAの『米油 適量』が成分表に無くて落ちていた(そのうえ原価側では前方一致で「米 60円/1合」に当たっていた)。売り場の「米油／こめ油」は米ぬかから搾った油で、八訂14003「米ぬか油」がその実収載。1mlあたり0.8gは他の食用油(サラダ油・ごま油・オリーブオイル)と同じ、大さじ1=12gの慣用値に合わせた値をそのまま使う(新しい数値は作っていない)"
    },
    {
      "id": "17036",
      "label": "ケチャップ",
      "mextName": "＜調味料類＞ （トマト加工品類） トマトケチャップ",
      "aliases": [
        "ケチャップ",
        "トマトケチャップ"
      ],
      "per100g": {
        "kcal": 116,
        "proteinG": 1.6,
        "fatG": 0.2,
        "carbG": 27.6,
        "saltG": 3.1,
        "fiberG": 1.7,
        "ironMg": 0.5,
        "calciumMg": 16
      },
      "unitGrams": {
        "大さじ": 15,
        "小さじ": 5
      }
    },
    {
      "id": "17042",
      "label": "マヨネーズ",
      "mextName": "＜調味料類＞ （ドレッシング類） 半固体状ドレッシング マヨネーズ 全卵型",
      "aliases": [
        "マヨネーズ"
      ],
      "per100g": {
        "kcal": 668,
        "proteinG": 1.4,
        "fatG": 76,
        "carbG": 3.6,
        "saltG": 1.9,
        "fiberG": 0,
        "ironMg": 0.3,
        "calciumMg": 8
      },
      "unitGrams": {
        "大さじ": 12,
        "小さじ": 4
      }
    },
    {
      "id": "17001",
      "label": "ウスターソース",
      "mextName": "＜調味料類＞ （ウスターソース類） ウスターソース",
      "aliases": [
        "ウスターソース"
      ],
      "per100g": {
        "kcal": 117,
        "proteinG": 1,
        "fatG": 0.1,
        "carbG": 27.1,
        "saltG": 8.5,
        "fiberG": 0.5,
        "ironMg": 1.6,
        "calciumMg": 59
      },
      "gramsPerMl": 1.2
    },
    {
      "id": "17002",
      "label": "中濃ソース",
      "mextName": "＜調味料類＞ （ウスターソース類） 中濃ソース",
      "aliases": [
        "中濃ソース"
      ],
      "rawAliases": [
        "ソース"
      ],
      "per100g": {
        "kcal": 129,
        "proteinG": 0.8,
        "fatG": 0.1,
        "carbG": 30.9,
        "saltG": 5.8,
        "fiberG": 1,
        "ironMg": 1.7,
        "calciumMg": 61
      },
      "gramsPerMl": 1.2,
      "note": "「ソース」とだけ書かれた場合は中濃ソースで代表"
    },
    {
      "id": "17031",
      "label": "オイスターソース",
      "mextName": "＜調味料類＞ （調味ソース類） オイスターソース",
      "aliases": [
        "オイスターソース"
      ],
      "per100g": {
        "kcal": 105,
        "proteinG": 7.7,
        "fatG": 0.3,
        "carbG": 18.3,
        "saltG": 11.4,
        "fiberG": 0.2,
        "ironMg": 1.2,
        "calciumMg": 25
      },
      "unitGrams": {
        "大さじ": 18,
        "小さじ": 6
      },
      "gramsPerMl": 1.2,
      "note": "gramsPerMlはウスターソース・中濃ソースと同じ濃度調味料としての概算値(2026-07-21追加。ml/cc表記への耐性を上げる目的)"
    },
    {
      "id": "17137",
      "label": "ポン酢",
      "mextName": "＜調味料類＞ （調味ソース類） ぽん酢しょうゆ 市販品",
      "aliases": [
        "ポン酢",
        "ポン酢しょうゆ"
      ],
      "per100g": {
        "kcal": 59,
        "proteinG": 3.7,
        "fatG": 0,
        "carbG": 10.8,
        "saltG": 7.8,
        "fiberG": 0.3,
        "ironMg": 0.7,
        "calciumMg": 16
      },
      "gramsPerMl": 1.1
    },
    {
      "id": "17029",
      "label": "めんつゆ（ストレート）",
      "mextName": "＜調味料類＞ （だし類） めんつゆ ストレート",
      "aliases": [
        "めんつゆ(ストレート)",
        "ストレートめんつゆ"
      ],
      "per100g": {
        "kcal": 44,
        "proteinG": 2.2,
        "fatG": 0,
        "carbG": 8.7,
        "saltG": 3.3,
        "fiberG": 0,
        "ironMg": 0.4,
        "calciumMg": 8
      },
      "gramsPerMl": 1.1
    },
    {
      "id": "17141",
      "label": "めんつゆ（2倍濃縮）",
      "mextName": "＜調味料類＞ （だし類） めんつゆ 二倍濃縮",
      "aliases": [
        "めんつゆ(2倍濃縮)",
        "めんつゆ2倍濃縮",
        "めんつゆ二倍濃縮",
        "めんつゆ"
      ],
      "per100g": {
        "kcal": 71,
        "proteinG": 3.4,
        "fatG": 0,
        "carbG": 14.4,
        "saltG": 6.6,
        "fiberG": 0,
        "ironMg": 0.6,
        "calciumMg": 12
      },
      "gramsPerMl": 1.1,
      "note": "濃縮倍率の記載が無い「めんつゆ」は2倍濃縮で代表"
    },
    {
      "id": "17030",
      "label": "めんつゆ（3倍濃縮）",
      "mextName": "＜調味料類＞ （だし類） めんつゆ 三倍濃縮",
      "aliases": [
        "めんつゆ(3倍濃縮)",
        "めんつゆ3倍濃縮",
        "めんつゆ三倍濃縮"
      ],
      "per100g": {
        "kcal": 98,
        "proteinG": 4.5,
        "fatG": 0,
        "carbG": 20,
        "saltG": 9.9,
        "fiberG": 0,
        "ironMg": 0.8,
        "calciumMg": 16
      },
      "gramsPerMl": 1.1
    },
    {
      "id": "17030",
      "label": "白だし",
      "mextName": "＜調味料類＞ （だし類） めんつゆ 三倍濃縮",
      "aliases": [
        "白だし",
        "割烹白だし",
        "白だし(濃縮)"
      ],
      "per100g": {
        "kcal": 98,
        "proteinG": 4.5,
        "fatG": 0,
        "carbG": 20,
        "saltG": 9.9,
        "fiberG": 0,
        "ironMg": 0.8,
        "calciumMg": 16
      },
      "gramsPerMl": 1.1,
      "note": "2026-08-23 便KF。八訂に「白だし」の収載は無い。市販の白だしは食塩相当量がおおむね10g/100ml前後(各社の栄養成分表示)で、八訂の収載品でこれにいちばん近いのが「めんつゆ 三倍濃縮」(17030・9.9g/100g)なので、これを代表として当てる(ターメリック→カレー粉と同じ「実収載品からの近似」。市販品の数値を書き写してはいない)。大さじ1(15ml×1.1=16.5g)で食塩相当量約1.6g＝実測の目安(約1.4〜1.6g)と同じ桁に収まり、ずれる向きも多め側なので減塩の判断を甘くしない。実データでは白だしが3件落ち、「トマトと大葉のだしマリネ」が塩分0.0g、「ささみのねぎだく塩レモン」が0.2gと表示されていた"
    },
    {
      "id": "17028",
      "label": "和風だしの素",
      "mextName": "＜調味料類＞ （だし類） 顆粒和風だし",
      "aliases": [
        "だしの素",
        "顆粒だし",
        "和風だし",
        "ほんだし",
        "和風スープの素"
      ],
      "per100g": {
        "kcal": 223,
        "proteinG": 24.2,
        "fatG": 0.3,
        "carbG": 31.1,
        "saltG": 40.6,
        "fiberG": 0,
        "ironMg": 1,
        "calciumMg": 42
      },
      "unitGrams": {
        "大さじ": 9,
        "小さじ": 3
      },
      "note": "2026-08-23 便KF: 「和風スープの素」を別名に足した。「スープの素」をコンソメ(洋風)へ寄せたので、和風と書いてあるものが洋風に流れないよう先に受け止める"
    },
    {
      "id": "17093",
      "label": "鶏がらスープの素",
      "mextName": "＜調味料類＞ （だし類） 顆粒中華だし",
      "aliases": [
        "鶏がらスープの素",
        "中華だし",
        "中華スープの素",
        "鶏がらだしの素",
        "丸鶏がらスープ",
        "鶏がらスープ",
        "鶏ガラスープ",
        "がらスープ"
      ],
      "per100g": {
        "kcal": 210,
        "proteinG": 12.6,
        "fatG": 1.6,
        "carbG": 36.6,
        "saltG": 47.5,
        "fiberG": 0,
        "ironMg": 0.6,
        "calciumMg": 84
      },
      "unitGrams": {
        "大さじ": 9,
        "小さじ": 3
      },
      "note": "2026-08-23 便KF: 「丸鶏がらスープ」「鶏がらスープ」を別名に足した。実データの麻婆豆腐で『「丸鶏がらスープ™」 小さじ1』が成分データ無しで落ち、塩分が過小に出ていた。中身は顆粒の中華だし(八訂17093)で、小さじ1=3gで食塩相当量約1.4g"
    },
    {
      "id": "17027",
      "label": "コンソメ",
      "mextName": "＜調味料類＞ （だし類） 固形ブイヨン",
      "aliases": [
        "コンソメ",
        "固形コンソメ",
        "ブイヨン",
        "固形スープの素",
        "洋風スープの素",
        "スープの素"
      ],
      "per100g": {
        "kcal": 233,
        "proteinG": 7,
        "fatG": 4.3,
        "carbG": 42.1,
        "saltG": 43.2,
        "fiberG": 0.3,
        "ironMg": 0.4,
        "calciumMg": 26
      },
      "unitGrams": {
        "個": 5,
        "大さじ": 9,
        "小さじ": 3
      },
      "note": "2026-08-23 便KF: 「固形スープの素」を別名に足した。八訂17027の収載名がそのまま「固形ブイヨン」で、日本の家庭向けレシピが「固形スープの素」と書くものと同じ(実データ「具だくさんの野菜スープ」の『固形スープの素 1個』が落ち、塩分が過小に出ていた。固形1個=5gで食塩相当量約2.2g)。倍率の書かれない「スープの素」も洋風の固形/顆粒を指すのが通例なので同じ食品へ寄せる(「鶏がらスープの素」「中華スープの素」「和風スープの素」は完全一致が先に当たるので巻き込まない)"
    },
    {
      "id": "17021",
      "label": "だし汁",
      "mextName": "＜調味料類＞ （だし類） かつお・昆布だし 荒節・昆布だし",
      "aliases": [
        "だし汁",
        "出汁",
        "かつおだし",
        "昆布だし"
      ],
      "per100g": {
        "kcal": 2,
        "proteinG": 0.3,
        "fatG": 0,
        "carbG": 0.3,
        "saltG": 0.1,
        "fiberG": 0,
        "ironMg": 0,
        "calciumMg": 3
      },
      "gramsPerMl": 1
    },
    {
      "id": "17051",
      "label": "カレールー",
      "mextName": "＜調味料類＞ （ルウ類） カレールウ",
      "aliases": [
        "カレールー",
        "カレールウ"
      ],
      "per100g": {
        "kcal": 474,
        "proteinG": 6.5,
        "fatG": 34.1,
        "carbG": 44.7,
        "saltG": 10.6,
        "fiberG": 6.4,
        "ironMg": 3.5,
        "calciumMg": 90
      },
      "unitGrams": {
        "箱": 200,
        "かけ": 20,
        "皿分": 20
      }
    },
    {
      "id": "17052",
      "label": "ハヤシライスルー",
      "mextName": "＜調味料類＞ （ルウ類） ハヤシルウ",
      "aliases": [
        "ハヤシライスルー",
        "ハヤシルー"
      ],
      "per100g": {
        "kcal": 501,
        "proteinG": 5.8,
        "fatG": 33.2,
        "carbG": 47.5,
        "saltG": 10.7,
        "fiberG": 2.5,
        "ironMg": 1,
        "calciumMg": 30
      },
      "unitGrams": {
        "箱": 200,
        "かけ": 20
      }
    },
    {
      "id": "17061",
      "label": "カレー粉",
      "mextName": "＜香辛料類＞ カレー粉",
      "aliases": [
        "カレー粉",
        "カレーパウダー",
        "ターメリック"
      ],
      "per100g": {
        "kcal": 338,
        "proteinG": 13,
        "fatG": 12.2,
        "carbG": 63.3,
        "saltG": 0.1,
        "fiberG": 36.9,
        "ironMg": 29,
        "calciumMg": 540
      },
      "unitGrams": {
        "大さじ": 6,
        "小さじ": 2
      },
      "note": "「カレーパウダー」はカレー粉の表記ゆれとして追加(2026-07-21)。「ターメリック」は八訂に収載が無いため、ウコン(ターメリック)が主成分であるカレー粉の値を代表として使用(捏造ではなく八訂の実収載品からの近似。オーナー実機報告「対象外13件」調査で追加)。ターメリック単体とは色合い・使用量の文脈が違う点は認識されたい"
    },
    {
      "id": "17065",
      "label": "こしょう",
      "mextName": "＜香辛料類＞ こしょう 混合 粉",
      "aliases": [
        "こしょう"
      ],
      "per100g": {
        "kcal": 369,
        "proteinG": 10.6,
        "fatG": 6.2,
        "carbG": 68.3,
        "saltG": 0.1,
        "fiberG": 0,
        "ironMg": 14,
        "calciumMg": 330
      },
      "unitGrams": {
        "小さじ": 2
      },
      "note": "銘柄を限定しない「こしょう」の代表値。黒こしょう限定の表記は専用食品(17063)を使う(2026-07-21分離)"
    },
    {
      "id": "17063",
      "label": "黒こしょう",
      "mextName": "＜香辛料類＞ こしょう 黒 粉",
      "aliases": [
        "黒こしょう",
        "黒胡椒",
        "ブラックペッパー"
      ],
      "per100g": {
        "kcal": 362,
        "proteinG": 11,
        "fatG": 6,
        "carbG": 66.6,
        "saltG": 0.2,
        "fiberG": 0,
        "ironMg": 20,
        "calciumMg": 410
      },
      "unitGrams": {
        "小さじ": 2
      },
      "note": "2026-07-21・オーナー実機報告「対象外13件」調査で追加。以前は「黒こしょう」「ブラックペッパー」を混合こしょう(17065)のaliasとして扱っていたが、黒こしょう専用の収載品(17063)があるためこちらに分離(より正確な値になる)。「黒胡椒」(漢字表記)は正規化後も生の文字列比較(旧matchAssumed)では拾えていなかった別バグも合わせて修正(src/logic/nutrition.ts参照)"
    },
    {
      "id": "17069",
      "label": "おろししょうが（チューブ）",
      "mextName": "＜香辛料類＞ しょうが おろし",
      "aliases": [
        "おろししょうが",
        "しょうがチューブ",
        "チューブしょうが"
      ],
      "per100g": {
        "kcal": 41,
        "proteinG": 0.7,
        "fatG": 0.6,
        "carbG": 8.6,
        "saltG": 1.5,
        "fiberG": 0,
        "ironMg": 0.3,
        "calciumMg": 16
      },
      "unitGrams": {
        "大さじ": 15,
        "小さじ": 5
      }
    },
    {
      "id": "17076",
      "label": "おろしにんにく（チューブ）",
      "mextName": "＜香辛料類＞ にんにく おろし",
      "aliases": [
        "おろしにんにく",
        "にんにくチューブ",
        "チューブにんにく"
      ],
      "per100g": {
        "kcal": 170,
        "proteinG": 4.7,
        "fatG": 0.5,
        "carbG": 37,
        "saltG": 4.6,
        "fiberG": 0,
        "ironMg": 0.7,
        "calciumMg": 22
      },
      "unitGrams": {
        "大さじ": 15,
        "小さじ": 5,
        "片": 6,
        "かけ": 6
      },
      "note": "2026-08-25 便KL: 「片」「かけ」を足した。レシピの『おろしにんにく 1片』は「生にんにく1片ぶんをすりおろした量」という意味なので、重さは成分表が既に持つにんにく(06223)の 片=6g・かけ=6g と同じ(新しい数値は作っていない)。影響範囲テストAの『おろしにんにく 1片』が単位を換算できずに落ちていた。なお同じ90品にある『おろしにんにく 1/2片強分』は、単位欄が「片強分」＝「強」という書き足しが挟まっているため、これを足しても換算できないままにしてある(「強」がどれだけ多いのかは書いた人にしか分からないので、勝手な重さを当てない)"
    },
    {
      "id": "03022",
      "label": "はちみつ",
      "mextName": "（その他） はちみつ",
      "aliases": [
        "はちみつ"
      ],
      "per100g": {
        "kcal": 329,
        "proteinG": 0.3,
        "fatG": 0,
        "carbG": 81.9,
        "saltG": 0,
        "fiberG": 0,
        "ironMg": 0.2,
        "calciumMg": 4
      },
      "unitGrams": {
        "大さじ": 21,
        "小さじ": 7
      }
    },
    {
      "id": "04101",
      "label": "こしあん",
      "mextName": "あずき あん こし練りあん （並あん）",
      "aliases": [
        "こしあん",
        "こし餡",
        "漉しあん"
      ],
      "per100g": {
        "kcal": 255,
        "proteinG": 5.6,
        "fatG": 0.3,
        "carbG": 58.8,
        "saltG": 0,
        "fiberG": 3.9,
        "ironMg": 1.6,
        "calciumMg": 42
      },
      "note": "市販の加糖こしあん想定(水ようかん・2026-07-11追加)"
    },
    {
      "id": "09049",
      "label": "粉寒天",
      "mextName": "てんぐさ 粉寒天",
      "aliases": [
        "粉寒天",
        "寒天"
      ],
      "per100g": {
        "kcal": 160,
        "proteinG": 0.2,
        "fatG": 0.3,
        "carbG": 81.7,
        "saltG": 0.4,
        "fiberG": 79,
        "ironMg": 7.3,
        "calciumMg": 120
      },
      "note": "水ようかん・2026-07-11追加"
    },
    {
      "id": "05018",
      "label": "いりごま",
      "mextName": "ごま いり",
      "aliases": [
        "いりごま",
        "白ごま",
        "黒ごま",
        "すりごま",
        "炒りごま",
        "ごま"
      ],
      "per100g": {
        "kcal": 605,
        "proteinG": 20.3,
        "fatG": 54.2,
        "carbG": 18.5,
        "saltG": 0,
        "fiberG": 12.6,
        "ironMg": 9.9,
        "calciumMg": 1200
      },
      "unitGrams": {
        "大さじ": 9,
        "小さじ": 3
      },
      "note": "2026-08-25 便KP: 何も付かない「ごま」を別名に足した(実データAの『ごま 少々』『ごま（白）1小さじ』が成分表でも価格マスタでも落ちていた)。「ごま」は2文字なので部分一致(3文字以上)には入らず、完全一致だけで拾う＝「ごま油」「白すりごま」など既に当たっていた材料の結果は1つも変わらない。八訂の「ごま 乾(05017)」ではなく「いり(05018)」に寄せるのは、家庭で使うごまは炒ってあるものだから(すりごま・白ごま・黒ごまが元からこの1件に寄っているのと同じ)"
    },
    {
      "id": "05042",
      "label": "練りごま",
      "mextName": "ごま ねり",
      "aliases": [
        "練りごま",
        "白練りごま"
      ],
      "per100g": {
        "kcal": 646,
        "proteinG": 19,
        "fatG": 61,
        "carbG": 15.6,
        "saltG": 0,
        "fiberG": 11.2,
        "ironMg": 5.8,
        "calciumMg": 590
      },
      "unitGrams": {
        "大さじ": 18,
        "小さじ": 6
      },
      "note": "2026-08-25 便KP: 価格マスタの項目名と同じ「白練りごま」を別名に足した。原価側は成分表の食品名を経由して価格マスタを引き直すので、この書き方を持っていないと『練りごま 大さじ2〜3』が価格なしで落ちる(実データB)。成分値・目安量は変えていない"
    },
    {
      "id": "07022",
      "label": "梅干し",
      "mextName": "うめ 梅干し 塩漬",
      "aliases": [
        "梅干し",
        "梅干"
      ],
      "per100g": {
        "kcal": 29,
        "proteinG": 0.9,
        "fatG": 0.7,
        "carbG": 8.6,
        "saltG": 18.2,
        "fiberG": 3.3,
        "ironMg": 1.1,
        "calciumMg": 33
      },
      "unitGrams": {
        "個": 10
      }
    },
    {
      "id": "07156",
      "label": "レモン汁",
      "mextName": "（かんきつ類） レモン 果汁 生",
      "aliases": [
        "レモン汁",
        "レモン果汁"
      ],
      "per100g": {
        "kcal": 24,
        "proteinG": 0.4,
        "fatG": 0.2,
        "carbG": 8.6,
        "saltG": 0,
        "fiberG": 0,
        "ironMg": 0.1,
        "calciumMg": 7
      },
      "gramsPerMl": 1
    },
    {
      "id": "07107",
      "label": "バナナ",
      "mextName": "バナナ 生",
      "aliases": [
        "バナナ"
      ],
      "per100g": {
        "kcal": 93,
        "proteinG": 1.1,
        "fatG": 0.2,
        "carbG": 22.5,
        "saltG": 0,
        "fiberG": 1.1,
        "ironMg": 0.3,
        "calciumMg": 6
      },
      "unitGrams": {
        "本": 90
      }
    },
    {
      "id": "07148",
      "label": "りんご",
      "mextName": "りんご 皮なし 生",
      "aliases": [
        "りんご"
      ],
      "per100g": {
        "kcal": 53,
        "proteinG": 0.1,
        "fatG": 0.2,
        "carbG": 15.5,
        "saltG": 0,
        "fiberG": 1.4,
        "ironMg": 0.1,
        "calciumMg": 3
      },
      "unitGrams": {
        "個": 220
      }
    },
    {
      "id": "06184",
      "label": "トマト缶",
      "mextName": "（トマト類） 加工品 ホール 食塩無添加",
      "aliases": [
        "トマト缶",
        "カットトマト缶",
        "ホールトマト缶",
        "トマト水煮缶"
      ],
      "per100g": {
        "kcal": 21,
        "proteinG": 0.9,
        "fatG": 0.2,
        "carbG": 4.4,
        "saltG": 0,
        "fiberG": 1.3,
        "ironMg": 0.4,
        "calciumMg": 9
      },
      "unitGrams": {
        "缶": 400
      }
    },
    {
      "id": "04029",
      "label": "きな粉",
      "mextName": "だいず ［全粒・全粒製品］ きな粉 黄大豆 全粒大豆",
      "aliases": [
        "きな粉"
      ],
      "per100g": {
        "kcal": 451,
        "proteinG": 36.7,
        "fatG": 25.7,
        "carbG": 28.5,
        "saltG": 0,
        "fiberG": 18.1,
        "ironMg": 8,
        "calciumMg": 190
      }
    },
    {
      "id": "07079",
      "label": "すだち",
      "mextName": "（かんきつ類） すだち 果汁 生",
      "aliases": [
        "すだち"
      ],
      "per100g": {
        "kcal": 29,
        "proteinG": 0.5,
        "fatG": 0.1,
        "carbG": 6.6,
        "saltG": 0,
        "fiberG": 0.1,
        "ironMg": 0.2,
        "calciumMg": 16
      },
      "note": "「すだち(またはレモン)」の主表記側。果汁(生)の値"
    },
    {
      "id": "08020",
      "label": "なめこ",
      "mextName": "なめこ 株採り 生",
      "aliases": [
        "なめこ"
      ],
      "per100g": {
        "kcal": 21,
        "proteinG": 1.8,
        "fatG": 0.2,
        "carbG": 5.4,
        "saltG": 0,
        "fiberG": 3.4,
        "ironMg": 0.7,
        "calciumMg": 4
      },
      "unitGrams": {
        "袋": 100
      },
      "note": "袋は「なめこと豆腐の味噌汁」レシピのmemo「1袋=100g程度が目安」から(2026-07-21追加)"
    },
    {
      "id": "07035",
      "label": "みかん缶",
      "mextName": "（かんきつ類） うんしゅうみかん 缶詰 果肉",
      "aliases": [
        "みかん缶"
      ],
      "per100g": {
        "kcal": 63,
        "proteinG": 0.5,
        "fatG": 0.1,
        "carbG": 15.3,
        "saltG": 0,
        "fiberG": 0.5,
        "ironMg": 0.4,
        "calciumMg": 8
      }
    },
    {
      "id": "03023",
      "label": "メープルシロップ",
      "mextName": "（その他） メープルシロップ",
      "aliases": [
        "メープルシロップ"
      ],
      "per100g": {
        "kcal": 266,
        "proteinG": 0.1,
        "fatG": 0,
        "carbG": 66.3,
        "saltG": 0,
        "fiberG": 0,
        "ironMg": 0.4,
        "calciumMg": 75
      }
    },
    {
      "id": "17006",
      "label": "ラー油",
      "mextName": "＜調味料類＞ （辛味調味料類） ラー油",
      "aliases": [
        "ラー油"
      ],
      "per100g": {
        "kcal": 887,
        "proteinG": 0.1,
        "fatG": 99.8,
        "carbG": 0,
        "saltG": 0,
        "fiberG": 0,
        "ironMg": 0.1,
        "calciumMg": 0
      },
      "gramsPerMl": 0.9,
      "note": "密度はサラダ油(0.8)・ごま油(0.8)に近い油脂系調味料として概算(2026-07-21追加。数値自体は八訂17006の成分値)"
    },
    {
      "id": "06278",
      "label": "三つ葉",
      "mextName": "（みつば類） 糸みつば 葉 生",
      "aliases": [
        "三つ葉",
        "みつば"
      ],
      "per100g": {
        "kcal": 12,
        "proteinG": 0.9,
        "fatG": 0.1,
        "carbG": 2.9,
        "saltG": 0,
        "fiberG": 2.3,
        "ironMg": 0.9,
        "calciumMg": 47
      },
      "note": "「三つ葉(または刻みのり)」の主表記側。糸みつば(スーパーでの一般的な流通形態)の値"
    },
    {
      "id": "17106",
      "label": "甜麺醤",
      "mextName": "＜調味料類＞ （調味ソース類） テンメンジャン",
      "aliases": [
        "甜麺醤",
        "テンメンジャン"
      ],
      "per100g": {
        "kcal": 249,
        "proteinG": 8.5,
        "fatG": 7.7,
        "carbG": 38.1,
        "saltG": 7.3,
        "fiberG": 3.1,
        "ironMg": 1.6,
        "calciumMg": 45
      },
      "unitGrams": {
        "大さじ": 18,
        "小さじ": 6
      },
      "note": "大さじ/小さじの重さは味噌類と同じペースト状調味料の目安で概算(2026-07-21追加)"
    },
    {
      "id": "17066",
      "label": "粉山椒",
      "mextName": "＜香辛料類＞ さんしょう 粉",
      "aliases": [
        "粉山椒",
        "さんしょう",
        "山椒"
      ],
      "per100g": {
        "kcal": 375,
        "proteinG": 10.3,
        "fatG": 6.2,
        "carbG": 69.6,
        "saltG": 0,
        "fiberG": 0,
        "ironMg": 10,
        "calciumMg": 750
      }
    },
    {
      "id": "04081",
      "label": "蒸し大豆",
      "mextName": "だいず ［全粒・全粒製品］ 蒸し大豆 黄大豆",
      "aliases": [
        "蒸し大豆"
      ],
      "per100g": {
        "kcal": 186,
        "proteinG": 16.6,
        "fatG": 9.8,
        "carbG": 13.8,
        "saltG": 0.6,
        "fiberG": 10.6,
        "ironMg": 2.8,
        "calciumMg": 75
      },
      "unitGrams": {
        "パック": 50
      },
      "note": "パックは「ツナと蒸し大豆の香味サラダ」レシピのmemo「1パック=50g程度が目安」から(2026-07-21追加)"
    },
    {
      "id": "04028",
      "label": "大豆（水煮）",
      "mextName": "だいず ［全粒・全粒製品］ 水煮缶詰 黄大豆",
      "aliases": [
        "大豆水煮",
        "水煮大豆",
        "大豆(水煮)",
        "ゆで大豆"
      ],
      "rawAliases": [
        "大豆"
      ],
      "per100g": {
        "kcal": 124,
        "proteinG": 12.9,
        "fatG": 6.7,
        "carbG": 7.7,
        "saltG": 0.5,
        "fiberG": 6.8,
        "ironMg": 1.8,
        "calciumMg": 100
      },
      "note": "2026-08-23 便KF。実データ「五目豆」の『大豆 150g』が成分データ無しで落ち、たんぱく質1.4gになっていた。材料欄に重さで「大豆」と書かれ、戻す・下ゆでの手順が無いレシピが指すのは市販の水煮・ドライパック大豆なので、八訂「水煮缶詰 黄大豆」(04028)を当てる。乾燥大豆(04023・372kcal/100g)を当てると2.3倍の過大表示になる。**素の「大豆」は rawAliases(正規化前の完全一致だけ)に置いてある**: 読みの「だいず」を部分一致に入れると「大豆もやし」「大豆油」「大豆ミート」まで水煮大豆に化けるため"
    },
    {
      "id": "17004",
      "label": "豆板醤",
      "mextName": "＜調味料類＞ （辛味調味料類） トウバンジャン",
      "aliases": [
        "豆板醤",
        "トウバンジャン"
      ],
      "per100g": {
        "kcal": 49,
        "proteinG": 2,
        "fatG": 2.3,
        "carbG": 7.9,
        "saltG": 17.8,
        "fiberG": 4.3,
        "ironMg": 2.3,
        "calciumMg": 32
      },
      "unitGrams": {
        "大さじ": 18,
        "小さじ": 6
      },
      "note": "大さじ/小さじの重さは味噌類と同じペースト状調味料の目安で概算(2026-07-21追加)"
    },
    {
      "id": "03029",
      "label": "黒みつ",
      "mextName": "（その他） 黒蜜",
      "aliases": [
        "黒みつ",
        "黒蜜"
      ],
      "per100g": {
        "kcal": 199,
        "proteinG": 1,
        "fatG": 0,
        "carbG": 50.5,
        "saltG": 0,
        "fiberG": 0,
        "ironMg": 2.6,
        "calciumMg": 140
      }
    },
    {
      "id": "04042",
      "label": "高野豆腐",
      "mextName": "だいず ［豆腐・油揚げ類］ 凍り豆腐 乾",
      "aliases": [
        "高野豆腐",
        "凍り豆腐"
      ],
      "per100g": {
        "kcal": 496,
        "proteinG": 50.5,
        "fatG": 34.1,
        "carbG": 4.2,
        "saltG": 1.1,
        "fiberG": 2.5,
        "ironMg": 7.5,
        "calciumMg": 630
      },
      "unitGrams": {
        "枚": 17
      },
      "note": "bento(パック7)「高野豆腐の含め煮」で使用。乾燥状態(戻す前)の値で計算する(戻した後の重量で計算すると薄まって過小評価になるため、購入時の乾燥重量を基準にするのが実態に近い)。専用食品を追加する前は「豆腐」alias(木綿豆腐)への部分一致で誤って木綿豆腐の値(73kcal/100g)が使われていた(高野豆腐は乾燥496kcal/100gで6倍以上違う)。2026-07-13データ監査で発見・修正"
    },
    {
      "id": "06136",
      "label": "切り干し大根",
      "mextName": "（だいこん類） 切干しだいこん 乾",
      "aliases": [
        "切り干し大根",
        "切干大根"
      ],
      "per100g": {
        "kcal": 280,
        "proteinG": 9.7,
        "fatG": 0.8,
        "carbG": 69.7,
        "saltG": 0.5,
        "fiberG": 21.3,
        "ironMg": 3.1,
        "calciumMg": 500
      },
      "note": "bento(パック7)「切り干し大根のハリハリ漬け」で使用。乾燥状態の値(レシピの分量30gは乾燥時の重量)。専用食品を追加する前は「大根」への部分一致で誤って生大根の値(15kcal/100g)が使われていた(切り干し大根は乾燥280kcal/100gで大幅に違う)。2026-07-13データ監査で発見・修正"
    },
    {
      "id": "17051+17052",
      "label": "シチュールー",
      "mextName": "＜調味料類＞ （ルウ類） カレールウ(0.5) + ＜調味料類＞ （ルウ類） ハヤシルウ(0.5)",
      "aliases": [
        "シチュールー",
        "シチュールウ"
      ],
      "per100g": {
        "kcal": 488,
        "proteinG": 6.2,
        "fatG": 33.7,
        "carbG": 46.1,
        "saltG": 10.6,
        "fiberG": 4.5,
        "ironMg": 2.3,
        "calciumMg": 60
      },
      "unitGrams": {
        "箱": 200,
        "かけ": 20
      },
      "note": "八訂にクリームシチュールウ単体の収載が無いため、同じ「小麦粉+油脂の固形ルウ」であるカレールウとハヤシルウの平均値で代用(保守的な近似。実際のクリームシチュールウは乳成分中心でこの2つとは風味系統が異なるが、いずれも小麦粉・油脂主体の固形ルウという点でカロリー構成は近い)"
    },
    {
      "id": "custom:アーモンドエッセンス",
      "label": "アーモンドエッセンス",
      "mextName": "(八訂に収載なし。香料/エッセンス類は成分表の対象外)",
      "aliases": [
        "アーモンドエッセンス",
        "アーモンドエキス"
      ],
      "per100g": {
        "kcal": 200,
        "proteinG": 0,
        "fatG": 0,
        "carbG": 0.1,
        "saltG": 0,
        "fiberG": 0,
        "ironMg": 0,
        "calciumMg": 0
      },
      "note": "八訂に香料/エッセンス類の収載が無いための例外(custom)。一般的な洋菓子用エッセンス(アルコールベースの香料。中身の大半は水・アルコールで、風味成分はごく微量)の一般的な栄養表示を参考にした保守的な概算値であり、MEXT成分表に基づく値ではない。レシピ側の分量は常に「少々(お好みで)」表記のため、実際の計算では対象外(reason:amount)になり、この値が計算に使われることはない(名寄せの網羅目的で追加)"
    },
    {
      "id": "07012",
      "label": "いちご",
      "mextName": "いちご 生",
      "aliases": [
        "いちご"
      ],
      "per100g": {
        "kcal": 31,
        "proteinG": 0.9,
        "fatG": 0.1,
        "carbG": 8.5,
        "saltG": 0,
        "fiberG": 1.4,
        "ironMg": 0.3,
        "calciumMg": 17
      },
      "unitGrams": {
        "個": 15
      },
      "note": "フルーツヨーグルトバーク(第2弾)で使用。1個=15gはレシピ側memoの目安値"
    },
    {
      "id": "07054",
      "label": "キウイ",
      "mextName": "キウイフルーツ 緑肉種 生",
      "aliases": [
        "キウイ",
        "キウイフルーツ"
      ],
      "per100g": {
        "kcal": 51,
        "proteinG": 1,
        "fatG": 0.2,
        "carbG": 13.4,
        "saltG": 0,
        "fiberG": 2.6,
        "ironMg": 0.3,
        "calciumMg": 26
      },
      "unitGrams": {
        "個": 100
      },
      "note": "フルーツヨーグルトバーク(第2弾)で使用。1個=100gはレシピ側memoの目安値"
    },
    {
      "id": "07124",
      "label": "ブルーベリー",
      "mextName": "ブルーベリー 生",
      "aliases": [
        "ブルーベリー"
      ],
      "per100g": {
        "kcal": 48,
        "proteinG": 0.5,
        "fatG": 0.1,
        "carbG": 12.9,
        "saltG": 0,
        "fiberG": 3.3,
        "ironMg": 0.2,
        "calciumMg": 8
      },
      "note": "フルーツヨーグルトバーク(第2弾)で使用。レシピの分量は「適量(お好みで)」表記のため、追加後も実際の計算では対象外(reason:amount)のまま(名寄せの網羅目的で追加)"
    },
    {
      "id": "04052",
      "label": "豆乳",
      "mextName": "だいず ［その他］ 豆乳 豆乳",
      "aliases": [
        "豆乳"
      ],
      "per100g": {
        "kcal": 43,
        "proteinG": 3.6,
        "fatG": 2.8,
        "carbG": 2.3,
        "saltG": 0,
        "fiberG": 0.9,
        "ironMg": 1.2,
        "calciumMg": 15
      },
      "gramsPerMl": 1.03,
      "note": "豆乳担々スープ(第2弾)の「豆乳(無調整)」に対応。密度は牛乳と同じ1.03g/mlで概算(無調整豆乳は水分主体で近似)。調製豆乳(04053)とは別食品なので流用しない"
    },
    {
      "id": "17077",
      "label": "乾燥ハーブ",
      "mextName": "＜香辛料類＞ バジル 粉",
      "aliases": [
        "乾燥ハーブ"
      ],
      "per100g": {
        "kcal": 307,
        "proteinG": 21.1,
        "fatG": 2.2,
        "carbG": 50.6,
        "saltG": 0.1,
        "fiberG": 0,
        "ironMg": 120,
        "calciumMg": 2800
      },
      "unitGrams": {
        "小さじ": 1,
        "大さじ": 3
      },
      "note": "第16弾「鮭のハーブレモン焼き」「鶏もも肉のガーリックハーブ焼き」の「乾燥ハーブ(オレガノまたはバジル/ローズマリー)」に対応。オレガノ・ローズマリーは八訂に収載が無く、レシピ側も「好みのハーブでよい」と明記し銘柄を限定していないため、収載のある乾燥バジル(粉)の値を代表として使用(いずれも少量使用の乾燥葉物ハーブで、栄養価への影響はごく小さい)。単位重量(小さじ1=1g)は乾燥ハーブ類の一般的な目安(MEXTの値ではない概算)"
    },
    {
      "id": "10362",
      "label": "たこ",
      "mextName": "＜いか・たこ類＞ （たこ類） まだこ ゆで",
      "aliases": [
        "たこ"
      ],
      "per100g": {
        "kcal": 91,
        "proteinG": 21.7,
        "fatG": 0.7,
        "carbG": 0.1,
        "saltG": 0.6,
        "fiberG": 0,
        "ironMg": 0.2,
        "calciumMg": 19
      },
      "note": "辞書に「たこ」自体が無かった(便ALのカタログ監査は自社103品限定で対象外だった)。一般的に流通する茹でだこの値で代表"
    },
    {
      "id": "10283",
      "label": "あさり水煮缶",
      "mextName": "＜貝類＞ あさり 缶詰 水煮",
      "aliases": [
        "あさり水煮缶",
        "あさり缶",
        "アサリ缶詰",
        "あさりの缶詰"
      ],
      "per100g": {
        "kcal": 102,
        "proteinG": 20.3,
        "fatG": 2.2,
        "carbG": 1.9,
        "saltG": 1,
        "fiberG": 0,
        "ironMg": 30,
        "calciumMg": 110
      },
      "unitGrams": {
        "缶": 55
      },
      "note": "2026-07-21分量表記拡充: 生あさり(10281)とは別食品として追加(缶詰=廃棄率0%・むき身のみで、生の「殻付き200g」等とは中身の意味が違うため統合しない)。「1缶」=55g(固形量)は市販3社の実測(ニッスイ: 内容量125g/固形量60g・マルハニチロ: 130g/55g・清水食品(ミニ缶): 85g/40g)の中央値(55g)。清水食品はミニ缶と明記された小サイズ品のため参考値として含めたが、中央値を採るこの方式でも極端な外れ値にはならないと判断した(docs/47のグラノーラ/コチュジャンと同じ「市販品複数社の中央値」方式)"
    },
    {
      "id": "06175",
      "label": "とうもろこし",
      "mextName": "（とうもろこし類） スイートコーン 未熟種子 生",
      "aliases": [
        "とうもろこし"
      ],
      "per100g": {
        "kcal": 89,
        "proteinG": 3.6,
        "fatG": 1.7,
        "carbG": 16.8,
        "saltG": 0,
        "fiberG": 3,
        "ironMg": 0.8,
        "calciumMg": 3
      },
      "unitGrams": {
        "本": 150
      },
      "note": "既存の「コーン缶」(06180・缶詰)とは別食品として追加(生のとうもろこしは八訂に無かった)。1本(皮・ひげ・芯を除いた実の可食部)=150gは一般的な調理の目安量(MEXTの値ではない概算)。他の生野菜(ほうれん草・キャベツ等)と同じ方針で、加熱後(ゆで)の値ではなく生の値で代表する"
    },
    {
      "id": "06247",
      "label": "赤パプリカ",
      "mextName": "（ピーマン類） 赤ピーマン 果実 生",
      "aliases": [
        "赤パプリカ",
        "赤ピーマン"
      ],
      "per100g": {
        "kcal": 28,
        "proteinG": 1,
        "fatG": 0.2,
        "carbG": 7.2,
        "saltG": 0,
        "fiberG": 1.6,
        "ironMg": 0.4,
        "calciumMg": 7
      },
      "unitGrams": {
        "個": 150
      },
      "note": "八訂にパプリカ(野菜)専用の項目が無いため、最も近い赤ピーマンの値で代表(赤・黄・オレンジパプリカを一括りにした一般名としての「パプリカ」もここに寄せる)。1個=150gは一般的な調理の目安量(MEXTの値ではない概算)。スパイスの「パプリカ(粉/パウダー)」とは全く別の食品なので混同しないこと(下記17079参照)。2026-07-21分量表記拡充: 無印の「パプリカ」は元は野菜側を優先していたが、オーナー実機のURL取り込みレシピで「パプリカ(小さじ1)」のようにスパイス文脈で無印表記されるケースを確認したため、bareの「パプリカ」aliasは下記17079(スパイス)側に一本化した(自社カタログ103品に「パプリカ」の実使用例が無く、野菜側に残す積極的な理由が無かったため)。野菜として使う場合は「赤パプリカ」等、色を明記した表記で照合する"
    },
    {
      "id": "17079",
      "label": "パプリカ(粉)",
      "mextName": "＜香辛料類＞ パプリカ 粉",
      "aliases": [
        "パプリカパウダー",
        "パプリカ粉",
        "パプリカ"
      ],
      "per100g": {
        "kcal": 385,
        "proteinG": 15.5,
        "fatG": 11.6,
        "carbG": 55.6,
        "saltG": 0.2,
        "fiberG": 0,
        "ironMg": 21,
        "calciumMg": 170
      },
      "unitGrams": {
        "大さじ": 6,
        "小さじ": 2
      },
      "note": "スパイスの「パプリカパウダー」専用(野菜のパプリカ=赤パプリカ(06247)とは別食品)。単位重量はカレー粉と同じ粉末香辛料の目安で概算。無印の「パプリカ」もこちら(スパイス)を優先する(2026-07-21分量表記拡充。上記06247のnote参照)"
    },
    {
      "id": "custom:グラノーラ",
      "label": "グラノーラ",
      "mextName": "(八訂に収載なし。市販品3社の栄養成分表示の中央値で代表・2026-07-21)",
      "aliases": [
        "グラノーラ"
      ],
      "per100g": {
        "kcal": 444,
        "proteinG": 7.2,
        "fatG": 16,
        "carbG": 72.2,
        "saltG": 0.6,
        "fiberG": 9,
        "ironMg": 0,
        "calciumMg": 0
      },
      "note": "八訂に収載が無いため、市販品3社の公式栄養成分表示(100gあたりに換算)の中央値を採用: カルビー フルグラ(444kcal/7.2g/16.0g/72.2g/食物繊維9.0g/塩分0.4g)・日清シスコ ごろグラ贅沢果実(410kcal/6.5g/12.5g/75.5g/食物繊維11.0g/塩分0.625g)・日本ケロッグ 業務用グラノラ(458kcal/8.5g/17.3g/69.3g/食物繊維4.5g/塩分0.7g)。鉄・カルシウムはいずれの商品表示にも記載が無いため0(不明)扱い。詳細な出典URL等はdocs/47_栄養カバレッジ監査.mdに記録"
    },
    {
      "id": "custom:コチュジャン",
      "label": "コチュジャン",
      "mextName": "(八訂に収載なし。市販品3社の栄養成分表示の中央値で代表・2026-07-21)",
      "aliases": [
        "コチュジャン"
      ],
      "per100g": {
        "kcal": 229,
        "proteinG": 4.2,
        "fatG": 2,
        "carbG": 47.5,
        "saltG": 6.2,
        "fiberG": 0,
        "ironMg": 0,
        "calciumMg": 0
      },
      "unitGrams": {
        "大さじ": 18,
        "小さじ": 6
      },
      "note": "八訂に収載が無いため、市販品3社の公式栄養成分表示(100gあたりに換算)の中央値を採用: ユウキ食品 コチジャン(250kcal/5.8g/2g/52.1g/塩分7.1g)・モランボン コチュジャン(215kcal/3.9g/1.4g/35.1g/塩分2.7g)・CJ bibigo コチュジャン(229kcal/4.2g/2.4g/47.5g/塩分6.2g)。食物繊維・鉄・カルシウムはいずれの商品表示にも記載が無いため0(不明)扱い。詳細な出典URL等はdocs/47_栄養カバレッジ監査.mdに記録"
    },
    {
      "id": "10165",
      "label": "サバみそ煮缶",
      "mextName": "＜魚類＞ （さば類） 缶詰 みそ煮",
      "aliases": [
        "サバみそ煮缶",
        "さばのみそ煮缶",
        "さばみそ煮缶",
        "さば味噌煮缶",
        "サバ味噌煮缶"
      ],
      "per100g": {
        "kcal": 210,
        "proteinG": 16.3,
        "fatG": 13.9,
        "carbG": 6.6,
        "saltG": 1.1,
        "fiberG": 0,
        "ironMg": 2,
        "calciumMg": 210
      },
      "unitGrams": {
        "缶": 190
      },
      "note": "実データCの『さばのみそ煮缶 1缶』が成分表に無くて落ちていた(しかも原価側では前方一致で「さば 100円/1切れ」に当たっていた＝生のさば切り身の値段)。八訂は缶詰を 水煮(10164)・みそ煮(10165)・味付け(10166) の3つに分けて収載しており、みそ煮はこの10165。**司令部の指示にあった10164は水煮の番号で、みそ煮は10165**(公式Excelで確認)。1缶190gは、既にあるサバ水煮缶(10164)と同じ190gをそのまま使う(市販のさばみそ煮缶も同じ190g規格。新しい重さは作っていない)。みそ煮は水煮より食塩相当量が多い(0.9→1.1g/100g)ので、水煮に寄せず別の食品として持つ"
    },
    {
      "id": "06236",
      "label": "キムチ",
      "mextName": "はくさい 漬物 キムチ",
      "aliases": [
        "キムチ",
        "白菜キムチ"
      ],
      "per100g": {
        "kcal": 27,
        "proteinG": 2.3,
        "fatG": 0.1,
        "carbG": 5.4,
        "saltG": 2.9,
        "fiberG": 2.2,
        "ironMg": 0.5,
        "calciumMg": 50
      },
      "note": "実データAの『キムチ 200g』が成分表に無くて落ちていた。**キムチは100gあたり食塩相当量2.9gと塩分の主役級**で、これが落ちると「塩分が少ない品」という逆の読み取りになる(価格マスタには2026-08-23 便KEで既に「キムチ 250円/200g」を入れてあった)。八訂は野菜の漬物として06236「はくさい 漬物 キムチ」を実収載している。「キムチの素」(17136)は別の収載品なので、この別名には入れない"
    },
    {
      "id": "06385",
      "label": "香菜",
      "mextName": "コリアンダー 葉 生",
      "aliases": [
        "香菜",
        "パクチー",
        "シャンツァイ"
      ],
      "per100g": {
        "kcal": 18,
        "proteinG": 1.4,
        "fatG": 0.4,
        "carbG": 4.6,
        "saltG": 0,
        "fiberG": 4.2,
        "ironMg": 1.4,
        "calciumMg": 84
      },
      "note": "実データBの麻婆豆腐の『香菜 少々』が落ちていた。香菜＝パクチー＝シャンツァイで、八訂06385「コリアンダー 葉 生」がその実収載。**素の「コリアンダー」は別名に入れない**——日本のレシピで「コリアンダー 小さじ1」と書けば種を挽いた香辛料を指すことが多く、この収載品(生の葉)とは別物だから(八訂に香辛料としてのコリアンダーの収載は無いので、そちらは分からないまま対象外にする)"
    },
    {
      "id": "17136",
      "label": "キムチの素",
      "mextName": "＜調味料類＞ （その他） キムチの素",
      "aliases": [
        "キムチの素"
      ],
      "per100g": {
        "kcal": 125,
        "proteinG": 5.3,
        "fatG": 1,
        "carbG": 26,
        "saltG": 9.3,
        "fiberG": 3.6,
        "ironMg": 1.3,
        "calciumMg": 29
      },
      "note": "2026-08-25 便KP: キムチ(06236)を足したことで、「キムチの素」が部分一致でキムチに寄ってしまうのを防ぐために同時に足した。八訂は17136「キムチの素」を別の収載品として持っており、食塩相当量が9.3g/100gとキムチ(2.9g)の3倍以上ある。実データ90品・同梱109品のどちらにも出てこないが、**足したことで新しい取り違えを作らない**ために入れる"
    },
    {
      "id": "17058",
      "label": "練りからし",
      "mextName": "＜香辛料類＞ からし 練り",
      "aliases": [
        "練りからし",
        "ねりからし",
        "チューブからし",
        "和がらし"
      ],
      "per100g": {
        "kcal": 314,
        "proteinG": 5.9,
        "fatG": 14.5,
        "carbG": 40.1,
        "saltG": 7.4,
        "fiberG": 0,
        "ironMg": 2.1,
        "calciumMg": 60
      },
      "unitGrams": {
        "大さじ": 15,
        "小さじ": 5
      },
      "note": "実データCの『練りからし 小さじ1/2』が落ちていた。八訂は からし を 粉(17057)・練り(17058)・練りマスタード(17059)・粒入りマスタード(17060) に分けて収載しており、チューブの和がらしは17058。**食塩相当量7.4g/100gと塩分を持つ調味料**なので、落ちると塩分が実際より少なく出る。大さじ15g/小さじ5gは、水と同じ密度(1.0)の練り調味料としてアプリが既に使っているケチャップ・おろししょうが(チューブ)と同じ値をそのまま使う(新しい数値は作っていない)。素の「からし」は別名に入れない——「からし菜」(06052・野菜)を巻き込むため"
    },
    {
      "id": "17060",
      "label": "粒マスタード",
      "mextName": "＜香辛料類＞ からし 粒入りマスタード",
      "aliases": [
        "粒マスタード",
        "粒入りマスタード",
        "ホールマスタード"
      ],
      "per100g": {
        "kcal": 229,
        "proteinG": 7.6,
        "fatG": 16,
        "carbG": 12.7,
        "saltG": 4.1,
        "fiberG": 0,
        "ironMg": 2.4,
        "calciumMg": 130
      },
      "unitGrams": {
        "大さじ": 15,
        "小さじ": 5
      },
      "note": "実データCの『粒マスタード 小さじ1』が落ちていた。八訂17060「からし 粒入りマスタード」がその実収載(なめらかな方は17059「練りマスタード」で別物)。食塩相当量4.1g/100g。大さじ15g/小さじ5gは練りからし(17058)と同じ扱い"
    }
  ]
}
