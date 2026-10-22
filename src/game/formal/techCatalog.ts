import type {Resources,ResearchProject} from './model';
export type TechDefinition={id:string;name:string;age:number;buildings:Record<string,number>;cost:Resources;baseDurationMs:number;prerequisites:string[];milestone:number;civilizationId:string|null;scope:ResearchProject['technologyScope'];category:string;effect:string;status:'LOCKED'|'CALIBRATE'};
/** Native data transcribed from v84. B4 research ledger; B9-4 modern effects follow v94 §12.6.10–11. */
export const TECH_CATALOG:Readonly<Record<string,TechDefinition>>=Object.freeze(Object.fromEntries(([
  {
    "id": "blacksmith.melee.1",
    "name": "近戰武器 I",
    "age": 1,
    "buildings": {
      "blacksmith": 1
    },
    "cost": {
      "food": 600,
      "wood": 350,
      "stone": 150,
      "gold": 900
    },
    "baseDurationMs": 4500000,
    "prerequisites": [],
    "milestone": 0,
    "civilizationId": null,
    "scope": "traditional",
    "category": "blacksmith",
    "effect": "",
    "status": "CALIBRATE"
  },
  {
    "id": "blacksmith.ranged.1",
    "name": "遠程武器 I",
    "age": 1,
    "buildings": {
      "blacksmith": 2
    },
    "cost": {
      "food": 300,
      "wood": 800,
      "stone": 100,
      "gold": 800
    },
    "baseDurationMs": 4500000,
    "prerequisites": [],
    "milestone": 0,
    "civilizationId": null,
    "scope": "traditional",
    "category": "blacksmith",
    "effect": "",
    "status": "CALIBRATE"
  },
  {
    "id": "blacksmith.infantry-armor.1",
    "name": "步兵護具 I",
    "age": 1,
    "buildings": {
      "blacksmith": 3
    },
    "cost": {
      "food": 600,
      "wood": 300,
      "stone": 700,
      "gold": 400
    },
    "baseDurationMs": 4500000,
    "prerequisites": [],
    "milestone": 0,
    "civilizationId": null,
    "scope": "traditional",
    "category": "blacksmith",
    "effect": "",
    "status": "CALIBRATE"
  },
  {
    "id": "blacksmith.ranged-armor.1",
    "name": "遠程護具 I",
    "age": 1,
    "buildings": {
      "blacksmith": 4
    },
    "cost": {
      "food": 300,
      "wood": 600,
      "stone": 500,
      "gold": 600
    },
    "baseDurationMs": 4500000,
    "prerequisites": [],
    "milestone": 0,
    "civilizationId": null,
    "scope": "traditional",
    "category": "blacksmith",
    "effect": "",
    "status": "CALIBRATE"
  },
  {
    "id": "blacksmith.cavalry-armor.1",
    "name": "騎兵護具 I",
    "age": 1,
    "buildings": {
      "blacksmith": 5
    },
    "cost": {
      "food": 800,
      "wood": 200,
      "stone": 400,
      "gold": 600
    },
    "baseDurationMs": 4500000,
    "prerequisites": [],
    "milestone": 0,
    "civilizationId": null,
    "scope": "traditional",
    "category": "blacksmith",
    "effect": "",
    "status": "CALIBRATE"
  },
  {
    "id": "blacksmith.melee.2",
    "name": "近戰武器 II",
    "age": 2,
    "buildings": {
      "blacksmith": 6
    },
    "cost": {
      "food": 3600,
      "wood": 2100,
      "stone": 900,
      "gold": 5400
    },
    "baseDurationMs": 12600000,
    "prerequisites": [
      "blacksmith.melee.1"
    ],
    "milestone": 0,
    "civilizationId": null,
    "scope": "traditional",
    "category": "blacksmith",
    "effect": "",
    "status": "CALIBRATE"
  },
  {
    "id": "blacksmith.ranged.2",
    "name": "遠程武器 II",
    "age": 2,
    "buildings": {
      "blacksmith": 7
    },
    "cost": {
      "food": 1800,
      "wood": 4800,
      "stone": 600,
      "gold": 4800
    },
    "baseDurationMs": 12600000,
    "prerequisites": [
      "blacksmith.ranged.1"
    ],
    "milestone": 0,
    "civilizationId": null,
    "scope": "traditional",
    "category": "blacksmith",
    "effect": "",
    "status": "CALIBRATE"
  },
  {
    "id": "blacksmith.infantry-armor.2",
    "name": "步兵護具 II",
    "age": 2,
    "buildings": {
      "blacksmith": 8
    },
    "cost": {
      "food": 3600,
      "wood": 1800,
      "stone": 4200,
      "gold": 2400
    },
    "baseDurationMs": 12600000,
    "prerequisites": [
      "blacksmith.infantry-armor.1"
    ],
    "milestone": 0,
    "civilizationId": null,
    "scope": "traditional",
    "category": "blacksmith",
    "effect": "",
    "status": "CALIBRATE"
  },
  {
    "id": "blacksmith.ranged-armor.2",
    "name": "遠程護具 II",
    "age": 2,
    "buildings": {
      "blacksmith": 9
    },
    "cost": {
      "food": 1800,
      "wood": 3600,
      "stone": 3000,
      "gold": 3600
    },
    "baseDurationMs": 12600000,
    "prerequisites": [
      "blacksmith.ranged-armor.1"
    ],
    "milestone": 0,
    "civilizationId": null,
    "scope": "traditional",
    "category": "blacksmith",
    "effect": "",
    "status": "CALIBRATE"
  },
  {
    "id": "blacksmith.cavalry-armor.2",
    "name": "騎兵護具 II",
    "age": 2,
    "buildings": {
      "blacksmith": 10
    },
    "cost": {
      "food": 4800,
      "wood": 1200,
      "stone": 2400,
      "gold": 3600
    },
    "baseDurationMs": 12600000,
    "prerequisites": [
      "blacksmith.cavalry-armor.1"
    ],
    "milestone": 0,
    "civilizationId": null,
    "scope": "traditional",
    "category": "blacksmith",
    "effect": "",
    "status": "CALIBRATE"
  },
  {
    "id": "blacksmith.melee.3",
    "name": "近戰武器 III",
    "age": 3,
    "buildings": {
      "blacksmith": 11
    },
    "cost": {
      "food": 12000,
      "wood": 7000,
      "stone": 3000,
      "gold": 18000
    },
    "baseDurationMs": 25200000,
    "prerequisites": [
      "blacksmith.melee.2"
    ],
    "milestone": 0,
    "civilizationId": null,
    "scope": "traditional",
    "category": "blacksmith",
    "effect": "",
    "status": "CALIBRATE"
  },
  {
    "id": "blacksmith.ranged.3",
    "name": "遠程武器 III",
    "age": 3,
    "buildings": {
      "blacksmith": 12
    },
    "cost": {
      "food": 6000,
      "wood": 16000,
      "stone": 2000,
      "gold": 16000
    },
    "baseDurationMs": 25200000,
    "prerequisites": [
      "blacksmith.ranged.2"
    ],
    "milestone": 0,
    "civilizationId": null,
    "scope": "traditional",
    "category": "blacksmith",
    "effect": "",
    "status": "CALIBRATE"
  },
  {
    "id": "blacksmith.infantry-armor.3",
    "name": "步兵護具 III",
    "age": 3,
    "buildings": {
      "blacksmith": 13
    },
    "cost": {
      "food": 12000,
      "wood": 6000,
      "stone": 14000,
      "gold": 8000
    },
    "baseDurationMs": 25200000,
    "prerequisites": [
      "blacksmith.infantry-armor.2"
    ],
    "milestone": 0,
    "civilizationId": null,
    "scope": "traditional",
    "category": "blacksmith",
    "effect": "",
    "status": "CALIBRATE"
  },
  {
    "id": "blacksmith.ranged-armor.3",
    "name": "遠程護具 III",
    "age": 3,
    "buildings": {
      "blacksmith": 14
    },
    "cost": {
      "food": 6000,
      "wood": 12000,
      "stone": 10000,
      "gold": 12000
    },
    "baseDurationMs": 25200000,
    "prerequisites": [
      "blacksmith.ranged-armor.2"
    ],
    "milestone": 0,
    "civilizationId": null,
    "scope": "traditional",
    "category": "blacksmith",
    "effect": "",
    "status": "CALIBRATE"
  },
  {
    "id": "blacksmith.cavalry-armor.3",
    "name": "騎兵護具 III",
    "age": 3,
    "buildings": {
      "blacksmith": 15
    },
    "cost": {
      "food": 16000,
      "wood": 4000,
      "stone": 8000,
      "gold": 12000
    },
    "baseDurationMs": 25200000,
    "prerequisites": [
      "blacksmith.cavalry-armor.2"
    ],
    "milestone": 0,
    "civilizationId": null,
    "scope": "traditional",
    "category": "blacksmith",
    "effect": "",
    "status": "CALIBRATE"
  },
  {
    "id": "economy.food.1",
    "name": "農業 I",
    "age": 1,
    "buildings": {
      "academy": 1,
      "mill": 1
    },
    "cost": {
      "food": 400,
      "wood": 800,
      "stone": 300,
      "gold": 300
    },
    "baseDurationMs": 3600000,
    "prerequisites": [],
    "milestone": 0,
    "civilizationId": null,
    "scope": "traditional",
    "category": "general",
    "effect": "+3% per tier",
    "status": "CALIBRATE"
  },
  {
    "id": "economy.wood.1",
    "name": "林業 I",
    "age": 1,
    "buildings": {
      "academy": 1,
      "lumbermill": 1
    },
    "cost": {
      "food": 300,
      "wood": 900,
      "stone": 200,
      "gold": 400
    },
    "baseDurationMs": 3600000,
    "prerequisites": [],
    "milestone": 0,
    "civilizationId": null,
    "scope": "traditional",
    "category": "general",
    "effect": "+3% per tier",
    "status": "CALIBRATE"
  },
  {
    "id": "economy.stone.1",
    "name": "採石 I",
    "age": 1,
    "buildings": {
      "academy": 1,
      "masonry": 1
    },
    "cost": {
      "food": 300,
      "wood": 600,
      "stone": 700,
      "gold": 200
    },
    "baseDurationMs": 3600000,
    "prerequisites": [],
    "milestone": 0,
    "civilizationId": null,
    "scope": "traditional",
    "category": "general",
    "effect": "+3% per tier",
    "status": "CALIBRATE"
  },
  {
    "id": "economy.gold.1",
    "name": "採礦 I",
    "age": 1,
    "buildings": {
      "academy": 1,
      "mint": 1
    },
    "cost": {
      "food": 300,
      "wood": 600,
      "stone": 200,
      "gold": 700
    },
    "baseDurationMs": 3600000,
    "prerequisites": [],
    "milestone": 0,
    "civilizationId": null,
    "scope": "traditional",
    "category": "general",
    "effect": "+3% per tier",
    "status": "CALIBRATE"
  },
  {
    "id": "economy.food.2",
    "name": "農業 II",
    "age": 2,
    "buildings": {
      "academy": 6,
      "mill": 4
    },
    "cost": {
      "food": 2000,
      "wood": 4000,
      "stone": 1500,
      "gold": 1500
    },
    "baseDurationMs": 10800000,
    "prerequisites": [
      "economy.food.1"
    ],
    "milestone": 0,
    "civilizationId": null,
    "scope": "traditional",
    "category": "general",
    "effect": "+3% per tier",
    "status": "CALIBRATE"
  },
  {
    "id": "economy.wood.2",
    "name": "林業 II",
    "age": 2,
    "buildings": {
      "academy": 6,
      "lumbermill": 4
    },
    "cost": {
      "food": 1500,
      "wood": 4500,
      "stone": 1000,
      "gold": 2000
    },
    "baseDurationMs": 10800000,
    "prerequisites": [
      "economy.wood.1"
    ],
    "milestone": 0,
    "civilizationId": null,
    "scope": "traditional",
    "category": "general",
    "effect": "+3% per tier",
    "status": "CALIBRATE"
  },
  {
    "id": "economy.stone.2",
    "name": "採石 II",
    "age": 2,
    "buildings": {
      "academy": 6,
      "masonry": 4
    },
    "cost": {
      "food": 1500,
      "wood": 3000,
      "stone": 3500,
      "gold": 1000
    },
    "baseDurationMs": 10800000,
    "prerequisites": [
      "economy.stone.1"
    ],
    "milestone": 0,
    "civilizationId": null,
    "scope": "traditional",
    "category": "general",
    "effect": "+3% per tier",
    "status": "CALIBRATE"
  },
  {
    "id": "economy.gold.2",
    "name": "採礦 II",
    "age": 2,
    "buildings": {
      "academy": 6,
      "mint": 4
    },
    "cost": {
      "food": 1500,
      "wood": 3000,
      "stone": 1000,
      "gold": 3500
    },
    "baseDurationMs": 10800000,
    "prerequisites": [
      "economy.gold.1"
    ],
    "milestone": 0,
    "civilizationId": null,
    "scope": "traditional",
    "category": "general",
    "effect": "+3% per tier",
    "status": "CALIBRATE"
  },
  {
    "id": "economy.food.3",
    "name": "農業 III",
    "age": 3,
    "buildings": {
      "academy": 11,
      "mill": 7
    },
    "cost": {
      "food": 7000,
      "wood": 13000,
      "stone": 5000,
      "gold": 5000
    },
    "baseDurationMs": 21600000,
    "prerequisites": [
      "economy.food.2"
    ],
    "milestone": 0,
    "civilizationId": null,
    "scope": "traditional",
    "category": "general",
    "effect": "+3% per tier",
    "status": "CALIBRATE"
  },
  {
    "id": "economy.wood.3",
    "name": "林業 III",
    "age": 3,
    "buildings": {
      "academy": 11,
      "lumbermill": 7
    },
    "cost": {
      "food": 5000,
      "wood": 15000,
      "stone": 3000,
      "gold": 7000
    },
    "baseDurationMs": 21600000,
    "prerequisites": [
      "economy.wood.2"
    ],
    "milestone": 0,
    "civilizationId": null,
    "scope": "traditional",
    "category": "general",
    "effect": "+3% per tier",
    "status": "CALIBRATE"
  },
  {
    "id": "economy.stone.3",
    "name": "採石 III",
    "age": 3,
    "buildings": {
      "academy": 11,
      "masonry": 7
    },
    "cost": {
      "food": 5000,
      "wood": 9000,
      "stone": 12000,
      "gold": 4000
    },
    "baseDurationMs": 21600000,
    "prerequisites": [
      "economy.stone.2"
    ],
    "milestone": 0,
    "civilizationId": null,
    "scope": "traditional",
    "category": "general",
    "effect": "+3% per tier",
    "status": "CALIBRATE"
  },
  {
    "id": "economy.gold.3",
    "name": "採礦 III",
    "age": 3,
    "buildings": {
      "academy": 11,
      "mint": 7
    },
    "cost": {
      "food": 4000,
      "wood": 9000,
      "stone": 3000,
      "gold": 14000
    },
    "baseDurationMs": 21600000,
    "prerequisites": [
      "economy.gold.2"
    ],
    "milestone": 0,
    "civilizationId": null,
    "scope": "traditional",
    "category": "general",
    "effect": "+3% per tier",
    "status": "CALIBRATE"
  },
  {
    "id": "intel.watch",
    "name": "城鎮警戒",
    "age": 1,
    "buildings": {
      "academy": 2,
      "embassy": 1
    },
    "cost": {
      "food": 300,
      "wood": 500,
      "stone": 200,
      "gold": 500
    },
    "baseDurationMs": 3600000,
    "prerequisites": [],
    "milestone": 0,
    "civilizationId": null,
    "scope": "traditional",
    "category": "general",
    "effect": "顯示小型／中型／大型／超大型",
    "status": "CALIBRATE"
  },
  {
    "id": "intel.patrol",
    "name": "巡邏制度",
    "age": 2,
    "buildings": {
      "academy": 8,
      "embassy": 5
    },
    "cost": {
      "food": 1500,
      "wood": 2500,
      "stone": 1000,
      "gold": 3000
    },
    "baseDurationMs": 9000000,
    "prerequisites": [],
    "milestone": 0,
    "civilizationId": null,
    "scope": "traditional",
    "category": "general",
    "effect": "判斷主要兵種傾向：步兵／遠程／騎兵",
    "status": "CALIBRATE"
  },
  {
    "id": "intel.analysis",
    "name": "軍情研判",
    "age": 2,
    "buildings": {
      "academy": 10,
      "embassy": 8
    },
    "cost": {
      "food": 2500,
      "wood": 4000,
      "stone": 2000,
      "gold": 5500
    },
    "baseDurationMs": 12600000,
    "prerequisites": [],
    "milestone": 0,
    "civilizationId": null,
    "scope": "traditional",
    "category": "general",
    "effect": "顯示「疑似攜帶攻城器」",
    "status": "CALIBRATE"
  },
  {
    "id": "intel.network",
    "name": "戰場情報網",
    "age": 3,
    "buildings": {
      "academy": 14,
      "embassy": 10
    },
    "cost": {
      "food": 8000,
      "wood": 10000,
      "stone": 6000,
      "gold": 16000
    },
    "baseDurationMs": 21600000,
    "prerequisites": [],
    "milestone": 0,
    "civilizationId": null,
    "scope": "traditional",
    "category": "general",
    "effect": "顯示「疑似聯軍」",
    "status": "CALIBRATE"
  },
  {
    "id": "military.drill",
    "name": "軍事操典",
    "age": 1,
    "buildings": {
      "academy": 4,
      "barracks": 5
    },
    "cost": {
      "food": 700,
      "wood": 800,
      "stone": 400,
      "gold": 1100
    },
    "baseDurationMs": 5400000,
    "prerequisites": [],
    "milestone": 0,
    "civilizationId": null,
    "scope": "traditional",
    "category": "general",
    "effect": "徒步步兵／徒步遠程／對應文明衛隊世界地圖行軍時間 −5%",
    "status": "CALIBRATE"
  },
  {
    "id": "military.horsemanship",
    "name": "馬術訓練",
    "age": 2,
    "buildings": {
      "academy": 4,
      "stable": 5
    },
    "cost": {
      "food": 3000,
      "wood": 2500,
      "stone": 1500,
      "gold": 5000
    },
    "baseDurationMs": 10800000,
    "prerequisites": [],
    "milestone": 0,
    "civilizationId": null,
    "scope": "traditional",
    "category": "general",
    "effect": "騎兵／騎乘文明衛隊世界地圖行軍時間 −5%",
    "status": "CALIBRATE"
  },
  {
    "id": "military.breeding",
    "name": "馬匹育種",
    "age": 2,
    "buildings": {
      "academy": 9,
      "stable": 8
    },
    "cost": {
      "food": 4500,
      "wood": 2500,
      "stone": 1500,
      "gold": 7500
    },
    "baseDurationMs": 14400000,
    "prerequisites": [],
    "milestone": 0,
    "civilizationId": null,
    "scope": "traditional",
    "category": "general",
    "effect": "騎兵／騎乘文明衛隊 HP +8%",
    "status": "CALIBRATE"
  },
  {
    "id": "military.conscription",
    "name": "徵兵制度",
    "age": 3,
    "buildings": {
      "academy": 14,
      "barracks": 10
    },
    "cost": {
      "food": 12000,
      "wood": 10000,
      "stone": 8000,
      "gold": 15000
    },
    "baseDurationMs": 25200000,
    "prerequisites": [],
    "milestone": 0,
    "civilizationId": null,
    "scope": "traditional",
    "category": "general",
    "effect": "一般戰鬥兵與文明衛隊訓練時間 −10%",
    "status": "CALIBRATE"
  },
  {
    "id": "logistics.transport",
    "name": "運輸組織",
    "age": 1,
    "buildings": {
      "academy": 3,
      "market": 1
    },
    "cost": {
      "food": 500,
      "wood": 900,
      "stone": 300,
      "gold": 800
    },
    "baseDurationMs": 4500000,
    "prerequisites": [],
    "milestone": 0,
    "civilizationId": null,
    "scope": "traditional",
    "category": "general",
    "effect": "一般戰鬥兵載重 +5%",
    "status": "CALIBRATE"
  },
  {
    "id": "logistics.auto",
    "name": "商路管理",
    "age": 2,
    "buildings": {
      "academy": 7,
      "market": 5
    },
    "cost": {
      "food": 2500,
      "wood": 5000,
      "stone": 2500,
      "gold": 5000
    },
    "baseDurationMs": 14400000,
    "prerequisites": [],
    "milestone": 0,
    "civilizationId": null,
    "scope": "traditional",
    "category": "general",
    "effect": "解鎖庫存門檻式自動物流",
    "status": "CALIBRATE"
  },
  {
    "id": "logistics.dispatch",
    "name": "車隊調度",
    "age": 2,
    "buildings": {
      "academy": 9,
      "market": 7
    },
    "cost": {
      "food": 2000,
      "wood": 5000,
      "stone": 2000,
      "gold": 3000
    },
    "baseDurationMs": 12600000,
    "prerequisites": [],
    "milestone": 0,
    "civilizationId": null,
    "scope": "traditional",
    "category": "general",
    "effect": "市場商隊世界地圖行軍時間 −10%",
    "status": "CALIBRATE"
  },
  {
    "id": "logistics.baggage",
    "name": "輜重標準化",
    "age": 2,
    "buildings": {
      "academy": 9,
      "workshop": 3
    },
    "cost": {
      "food": 2500,
      "wood": 6500,
      "stone": 2500,
      "gold": 2500
    },
    "baseDurationMs": 14400000,
    "prerequisites": [],
    "milestone": 0,
    "civilizationId": null,
    "scope": "traditional",
    "category": "general",
    "effect": "輜重車負重 +15%（1,000→1,150）",
    "status": "CALIBRATE"
  },
  {
    "id": "logistics.rations",
    "name": "軍糧配給",
    "age": 3,
    "buildings": {
      "academy": 14,
      "warehouse": 10
    },
    "cost": {
      "food": 16000,
      "wood": 8000,
      "stone": 6000,
      "gold": 15000
    },
    "baseDurationMs": 25200000,
    "prerequisites": [],
    "milestone": 0,
    "civilizationId": null,
    "scope": "traditional",
    "category": "general",
    "effect": "軍隊糧食消耗 −5%",
    "status": "CALIBRATE"
  },
  {
    "id": "engineering.masonry",
    "name": "石造工程",
    "age": 1,
    "buildings": {
      "academy": 5,
      "townhall": 3
    },
    "cost": {
      "food": 500,
      "wood": 1200,
      "stone": 1600,
      "gold": 700
    },
    "baseDurationMs": 7200000,
    "prerequisites": [],
    "milestone": 0,
    "civilizationId": null,
    "scope": "traditional",
    "category": "general",
    "effect": "一般建築／資源田攻城耐久 +10%",
    "status": "CALIBRATE"
  },
  {
    "id": "engineering.architecture",
    "name": "建築學",
    "age": 3,
    "buildings": {
      "academy": 12,
      "townhall": 10
    },
    "cost": {
      "food": 5000,
      "wood": 9000,
      "stone": 14000,
      "gold": 7000
    },
    "baseDurationMs": 21600000,
    "prerequisites": [],
    "milestone": 0,
    "civilizationId": null,
    "scope": "traditional",
    "category": "general",
    "effect": "再 +10%，累計 +20%",
    "status": "CALIBRATE"
  },
  {
    "id": "siege.ram.1",
    "name": "破城工程 I",
    "age": 2,
    "buildings": {
      "academy": 9,
      "workshop": 5
    },
    "cost": {
      "food": 2500,
      "wood": 5000,
      "stone": 6000,
      "gold": 2500
    },
    "baseDurationMs": 14400000,
    "prerequisites": [],
    "milestone": 0,
    "civilizationId": null,
    "scope": "traditional",
    "category": "general",
    "effect": "衝撞車破牆能力 +10%",
    "status": "CALIBRATE"
  },
  {
    "id": "siege.projection.1",
    "name": "投射工程 I",
    "age": 2,
    "buildings": {
      "academy": 9,
      "workshop": 5
    },
    "cost": {
      "food": 1500,
      "wood": 7000,
      "stone": 4000,
      "gold": 3500
    },
    "baseDurationMs": 14400000,
    "prerequisites": [],
    "milestone": 0,
    "civilizationId": null,
    "scope": "traditional",
    "category": "general",
    "effect": "投石機對一般建築／資源田破壞 +10%",
    "status": "CALIBRATE"
  },
  {
    "id": "siege.frame.1",
    "name": "強化機架 I",
    "age": 2,
    "buildings": {
      "academy": 9,
      "workshop": 5
    },
    "cost": {
      "food": 2500,
      "wood": 6500,
      "stone": 4500,
      "gold": 2500
    },
    "baseDurationMs": 14400000,
    "prerequisites": [],
    "milestone": 0,
    "civilizationId": null,
    "scope": "traditional",
    "category": "general",
    "effect": "攻城器 HP +8%",
    "status": "CALIBRATE"
  },
  {
    "id": "siege.ram.2",
    "name": "破城工程 II",
    "age": 3,
    "buildings": {
      "academy": 13,
      "workshop": 10
    },
    "cost": {
      "food": 8000,
      "wood": 12000,
      "stone": 18000,
      "gold": 7000
    },
    "baseDurationMs": 25200000,
    "prerequisites": [
      "siege.ram.1"
    ],
    "milestone": 0,
    "civilizationId": null,
    "scope": "traditional",
    "category": "general",
    "effect": "再 +10%，累計 +20%",
    "status": "CALIBRATE"
  },
  {
    "id": "siege.projection.2",
    "name": "投射工程 II",
    "age": 3,
    "buildings": {
      "academy": 13,
      "workshop": 10
    },
    "cost": {
      "food": 5000,
      "wood": 19000,
      "stone": 10000,
      "gold": 11000
    },
    "baseDurationMs": 25200000,
    "prerequisites": [
      "siege.projection.1"
    ],
    "milestone": 0,
    "civilizationId": null,
    "scope": "traditional",
    "category": "general",
    "effect": "再 +10%，累計 +20%",
    "status": "CALIBRATE"
  },
  {
    "id": "siege.frame.2",
    "name": "強化機架 II",
    "age": 3,
    "buildings": {
      "academy": 13,
      "workshop": 10
    },
    "cost": {
      "food": 7000,
      "wood": 18000,
      "stone": 13000,
      "gold": 7000
    },
    "baseDurationMs": 25200000,
    "prerequisites": [
      "siege.frame.1"
    ],
    "milestone": 0,
    "civilizationId": null,
    "scope": "traditional",
    "category": "general",
    "effect": "再 +8%，累計 +16%",
    "status": "CALIBRATE"
  },
  {
    "id": "administration.coordination",
    "name": "行政統籌",
    "age": 2,
    "buildings": {
      "academy": 10,
      "townhall": 5
    },
    "cost": {
      "food": 3000,
      "wood": 4000,
      "stone": 3000,
      "gold": 5000
    },
    "baseDurationMs": 14400000,
    "prerequisites": [],
    "milestone": 0,
    "civilizationId": null,
    "scope": "traditional",
    "category": "general",
    "effect": "儲存／批次套用多城治理方針",
    "status": "CALIBRATE"
  },
  {
    "id": "administration.register",
    "name": "領地帳冊",
    "age": 3,
    "buildings": {
      "academy": 14,
      "townhall": 10
    },
    "cost": {
      "food": 7000,
      "wood": 8000,
      "stone": 7000,
      "gold": 13000
    },
    "baseDurationMs": 18000000,
    "prerequisites": [],
    "milestone": 0,
    "civilizationId": null,
    "scope": "traditional",
    "category": "general",
    "effect": "解鎖跨城市庫存門檻、閒置佇列、住房／倉儲等集中管理規則",
    "status": "CALIBRATE"
  },
  {
    "id": "elite.infantry",
    "name": "步兵精銳化",
    "age": 3,
    "buildings": {
      "academy": 11
    },
    "cost": {
      "food": 4000,
      "wood": 5000,
      "stone": 2000,
      "gold": 4000
    },
    "baseDurationMs": 10800000,
    "prerequisites": [],
    "milestone": 22000,
    "civilizationId": null,
    "scope": "traditional",
    "category": "elite",
    "effect": "",
    "status": "LOCKED"
  },
  {
    "id": "elite.ranged",
    "name": "遠程精銳化",
    "age": 3,
    "buildings": {
      "academy": 12
    },
    "cost": {
      "food": 3000,
      "wood": 6000,
      "stone": 2000,
      "gold": 7000
    },
    "baseDurationMs": 14400000,
    "prerequisites": [],
    "milestone": 25000,
    "civilizationId": null,
    "scope": "traditional",
    "category": "elite",
    "effect": "",
    "status": "LOCKED"
  },
  {
    "id": "elite.cavalry",
    "name": "騎兵精銳化",
    "age": 3,
    "buildings": {
      "academy": 13
    },
    "cost": {
      "food": 6000,
      "wood": 3000,
      "stone": 2000,
      "gold": 9000
    },
    "baseDurationMs": 18000000,
    "prerequisites": [],
    "milestone": 25000,
    "civilizationId": null,
    "scope": "traditional",
    "category": "elite",
    "effect": "",
    "status": "LOCKED"
  },
  {
    "id": "elite.guard",
    "name": "文明衛隊精銳化",
    "age": 3,
    "buildings": {
      "academy": 15
    },
    "cost": {
      "food": 6000,
      "wood": 6000,
      "stone": 4000,
      "gold": 12000
    },
    "baseDurationMs": 25200000,
    "prerequisites": [],
    "milestone": 30000,
    "civilizationId": null,
    "scope": "traditional",
    "category": "elite",
    "effect": "",
    "status": "LOCKED"
  },
  {
    "id": "civilization.kaogong",
    "name": "考工制度",
    "age": 2,
    "buildings": {
      "academy": 10,
      "castle": 5
    },
    "cost": {
      "food": 3000,
      "wood": 7000,
      "stone": 5000,
      "gold": 9000
    },
    "baseDurationMs": 18000000,
    "prerequisites": [],
    "milestone": 0,
    "civilizationId": "civ_zhongguo",
    "scope": "traditional",
    "category": "civilization",
    "effect": "後續一般科技研究資源成本 −15%",
    "status": "CALIBRATE"
  },
  {
    "id": "civilization.crossbow",
    "name": "連弩操典",
    "age": 3,
    "buildings": {
      "academy": 15,
      "castle": 10
    },
    "cost": {
      "food": 7000,
      "wood": 18000,
      "stone": 5000,
      "gold": 30000
    },
    "baseDurationMs": 32400000,
    "prerequisites": [
      "civilization.kaogong"
    ],
    "milestone": 0,
    "civilizationId": "civ_zhongguo",
    "scope": "traditional",
    "category": "civilization",
    "effect": "弓兵／弩手／連弩衛隊攻擊間隔 −8%",
    "status": "CALIBRATE"
  },
  {
    "id": "civilization.themes",
    "name": "軍區制度",
    "age": 2,
    "buildings": {
      "academy": 10,
      "castle": 5
    },
    "cost": {
      "food": 6000,
      "wood": 4000,
      "stone": 6000,
      "gold": 8000
    },
    "baseDurationMs": 18000000,
    "prerequisites": [],
    "milestone": 0,
    "civilizationId": "civ_byzantium",
    "scope": "traditional",
    "category": "civilization",
    "effect": "槍兵系／戰矛兵系招募資源成本 −12%",
    "status": "CALIBRATE"
  },
  {
    "id": "civilization.imperial-wall",
    "name": "帝都城防",
    "age": 3,
    "buildings": {
      "academy": 15,
      "castle": 10
    },
    "cost": {
      "food": 8000,
      "wood": 8000,
      "stone": 25000,
      "gold": 19000
    },
    "baseDurationMs": 32400000,
    "prerequisites": [
      "civilization.themes"
    ],
    "milestone": 0,
    "civilizationId": "civ_byzantium",
    "scope": "traditional",
    "category": "civilization",
    "effect": "城牆／城門攻城耐久 +20%",
    "status": "CALIBRATE"
  },
  {
    "id": "civilization.knighthood",
    "name": "騎士制度",
    "age": 2,
    "buildings": {
      "academy": 10,
      "castle": 5
    },
    "cost": {
      "food": 9000,
      "wood": 3500,
      "stone": 2500,
      "gold": 9000
    },
    "baseDurationMs": 18000000,
    "prerequisites": [],
    "milestone": 0,
    "civilizationId": "civ_frankia",
    "scope": "traditional",
    "category": "civilization",
    "effect": "馬廄訓練速度 +12%",
    "status": "CALIBRATE"
  },
  {
    "id": "civilization.charge",
    "name": "重騎衝鋒",
    "age": 3,
    "buildings": {
      "academy": 15,
      "castle": 10
    },
    "cost": {
      "food": 22000,
      "wood": 6000,
      "stone": 4000,
      "gold": 28000
    },
    "baseDurationMs": 32400000,
    "prerequisites": [
      "civilization.knighthood"
    ],
    "milestone": 0,
    "civilizationId": "civ_frankia",
    "scope": "traditional",
    "category": "civilization",
    "effect": "騎士／重甲騎兵每場戰鬥首次接戰傷害 +8%",
    "status": "CALIBRATE"
  },
  {
    "id": "civilization.archer-levy",
    "name": "郡民弓役",
    "age": 2,
    "buildings": {
      "academy": 10,
      "castle": 5
    },
    "cost": {
      "food": 5000,
      "wood": 8000,
      "stone": 3000,
      "gold": 8000
    },
    "baseDurationMs": 18000000,
    "prerequisites": [],
    "milestone": 0,
    "civilizationId": "civ_britannia",
    "scope": "traditional",
    "category": "civilization",
    "effect": "徒步遠程兵種訓練速度 +12%",
    "status": "CALIBRATE"
  },
  {
    "id": "civilization.warwolf",
    "name": "戰狼投石",
    "age": 3,
    "buildings": {
      "academy": 15,
      "castle": 10
    },
    "cost": {
      "food": 6000,
      "wood": 25000,
      "stone": 12000,
      "gold": 17000
    },
    "baseDurationMs": 32400000,
    "prerequisites": [
      "civilization.archer-levy"
    ],
    "milestone": 0,
    "civilizationId": "civ_britannia",
    "scope": "traditional",
    "category": "civilization",
    "effect": "投石機單發最大波及目標 13→17",
    "status": "CALIBRATE"
  },
  {
    "id": "civilization.mobilization",
    "name": "武家動員",
    "age": 2,
    "buildings": {
      "academy": 10,
      "castle": 5
    },
    "cost": {
      "food": 7000,
      "wood": 5000,
      "stone": 3000,
      "gold": 9000
    },
    "baseDurationMs": 18000000,
    "prerequisites": [],
    "milestone": 0,
    "civilizationId": "civ_japan",
    "scope": "traditional",
    "category": "civilization",
    "effect": "步兵／步兵型文明衛隊訓練速度 +12%",
    "status": "CALIBRATE"
  },
  {
    "id": "civilization.sling",
    "name": "投石術",
    "age": 3,
    "buildings": {
      "academy": 15,
      "castle": 10
    },
    "cost": {
      "food": 8000,
      "wood": 24000,
      "stone": 10000,
      "gold": 18000
    },
    "baseDurationMs": 32400000,
    "prerequisites": [
      "civilization.mobilization"
    ],
    "milestone": 0,
    "civilizationId": "civ_japan",
    "scope": "traditional",
    "category": "civilization",
    "effect": "投石機攻擊間隔 −12%",
    "status": "CALIBRATE"
  },
  {
    "id": "civilization.nomadic",
    "name": "遊牧補給",
    "age": 2,
    "buildings": {
      "academy": 10,
      "castle": 5
    },
    "cost": {
      "food": 9000,
      "wood": 4000,
      "stone": 2500,
      "gold": 8500
    },
    "baseDurationMs": 18000000,
    "prerequisites": [],
    "milestone": 0,
    "civilizationId": "civ_mongolia",
    "scope": "traditional",
    "category": "civilization",
    "effect": "騎兵／騎乘文明衛隊糧耗 −10%",
    "status": "CALIBRATE"
  },
  {
    "id": "civilization.swift-siege",
    "name": "疾行攻城",
    "age": 3,
    "buildings": {
      "academy": 15,
      "castle": 10
    },
    "cost": {
      "food": 16000,
      "wood": 18000,
      "stone": 8000,
      "gold": 18000
    },
    "baseDurationMs": 32400000,
    "prerequisites": [
      "civilization.nomadic"
    ],
    "milestone": 0,
    "civilizationId": "civ_mongolia",
    "scope": "traditional",
    "category": "civilization",
    "effect": "衝撞車／投石機世界地圖行軍時間 −20%",
    "status": "CALIBRATE"
  },
  {
    "id": "research.cooperation",
    "name": "科研協同體系",
    "age": 0,
    "buildings": {
      "academy": 15
    },
    "cost": {
      "food": 60000,
      "wood": 80000,
      "stone": 70000,
      "gold": 90000
    },
    "baseDurationMs": 14400000,
    "prerequisites": [],
    "milestone": 0,
    "civilizationId": null,
    "scope": "research-cooperation",
    "category": "general",
    "effect": "完成後解鎖本人城市多城投入現代科研，仍使用唯一研究佇列",
    "status": "CALIBRATE"
  },
  {
    "id": "modern.infantry-weapons",
    "name": "現代步兵武裝",
    "age": 0,
    "buildings": {
      "academy": 15,
      "barracks": 15
    },
    "cost": {
      "food": 180000,
      "wood": 160000,
      "stone": 140000,
      "gold": 420000
    },
    "baseDurationMs": 14400000,
    "prerequisites": [
      "research.cooperation"
    ],
    "milestone": 0,
    "civilizationId": null,
    "scope": "modern-common",
    "category": "general",
    "effect": "現代徒步戰鬥兵與徒步衛隊攻擊 +8%",
    "status": "CALIBRATE"
  },
  {
    "id": "modern.personal-protection",
    "name": "個人防護裝備",
    "age": 0,
    "buildings": {
      "academy": 15,
      "barracks": 15
    },
    "cost": {
      "food": 200000,
      "wood": 180000,
      "stone": 260000,
      "gold": 260000
    },
    "baseDurationMs": 14400000,
    "prerequisites": [
      "research.cooperation"
    ],
    "milestone": 0,
    "civilizationId": null,
    "scope": "modern-common",
    "category": "general",
    "effect": "現代徒步戰鬥兵與徒步衛隊 HP +8%",
    "status": "CALIBRATE"
  },
  {
    "id": "modern.composite-armor",
    "name": "複合裝甲",
    "age": 0,
    "buildings": {
      "academy": 15,
      "stable": 15
    },
    "cost": {
      "food": 200000,
      "wood": 150000,
      "stone": 500000,
      "gold": 550000
    },
    "baseDurationMs": 21600000,
    "prerequisites": [
      "research.cooperation"
    ],
    "milestone": 0,
    "civilizationId": null,
    "scope": "modern-common",
    "category": "general",
    "effect": "裝甲偵察車、主力戰車、裝甲型衛隊 HP +10%",
    "status": "CALIBRATE"
  },
  {
    "id": "modern.digital-fire-control",
    "name": "數位火控系統",
    "age": 0,
    "buildings": {
      "academy": 15,
      "archery": 15
    },
    "cost": {
      "food": 120000,
      "wood": 250000,
      "stone": 230000,
      "gold": 600000
    },
    "baseDurationMs": 18000000,
    "prerequisites": [
      "research.cooperation"
    ],
    "milestone": 0,
    "civilizationId": null,
    "scope": "modern-common",
    "category": "general",
    "effect": "現代遠程兵、遠程衛隊、自走火炮攻擊間隔 −6%",
    "status": "CALIBRATE"
  },
  {
    "id": "modern.mechanized-logistics",
    "name": "機械化後勤",
    "age": 0,
    "buildings": {
      "academy": 15,
      "market": 15
    },
    "cost": {
      "food": 250000,
      "wood": 300000,
      "stone": 150000,
      "gold": 300000
    },
    "baseDurationMs": 14400000,
    "prerequisites": [
      "research.cooperation"
    ],
    "milestone": 0,
    "civilizationId": null,
    "scope": "modern-common",
    "category": "general",
    "effect": "全現代軍行軍時間 −10%；補給卡車載重提高至6,000",
    "status": "CALIBRATE"
  },
  {
    "id": "modern.supply-system",
    "name": "戰場補給體系",
    "age": 0,
    "buildings": {
      "academy": 15,
      "warehouse": 15
    },
    "cost": {
      "food": 400000,
      "wood": 200000,
      "stone": 150000,
      "gold": 250000
    },
    "baseDurationMs": 18000000,
    "prerequisites": [
      "research.cooperation"
    ],
    "milestone": 0,
    "civilizationId": null,
    "scope": "modern-common",
    "category": "general",
    "effect": "現代軍糧耗 −8%",
    "status": "CALIBRATE"
  },
  {
    "id": "modern.mobilization",
    "name": "現代動員制度",
    "age": 0,
    "buildings": {
      "academy": 15,
      "barracks": 15
    },
    "cost": {
      "food": 400000,
      "wood": 250000,
      "stone": 150000,
      "gold": 400000
    },
    "baseDurationMs": 21600000,
    "prerequisites": [
      "research.cooperation"
    ],
    "milestone": 0,
    "civilizationId": null,
    "scope": "modern-common",
    "category": "general",
    "effect": "所有現代兵與現代衛隊訓練時間 −15%",
    "status": "CALIBRATE"
  },
  {
    "id": "modern.siege-engineering",
    "name": "現代攻城工程",
    "age": 0,
    "buildings": {
      "academy": 15,
      "workshop": 15
    },
    "cost": {
      "food": 150000,
      "wood": 350000,
      "stone": 550000,
      "gold": 550000
    },
    "baseDurationMs": 25200000,
    "prerequisites": [
      "research.cooperation"
    ],
    "milestone": 0,
    "civilizationId": null,
    "scope": "modern-common",
    "category": "general",
    "effect": "破障車破牆與自走火炮對建築／資源田／奇觀破壞 +20%（奇觀任務待B9-5整合）",
    "status": "CALIBRATE"
  },
  {
    "id": "modern.data-link",
    "name": "戰術資料鏈",
    "age": 0,
    "buildings": {
      "academy": 15,
      "embassy": 15
    },
    "cost": {
      "food": 100000,
      "wood": 200000,
      "stone": 150000,
      "gold": 350000
    },
    "baseDurationMs": 14400000,
    "prerequisites": [
      "research.cooperation"
    ],
    "milestone": 0,
    "civilizationId": null,
    "scope": "modern-common",
    "category": "general",
    "effect": "現代偵察／反偵察 +25%；合法來襲情報增加主要與次要兵種",
    "status": "CALIBRATE"
  },
  {
    "id": "modern.civ_zhongguo.exclusive",
    "name": "火力協同網",
    "age": 0,
    "buildings": {
      "academy": 15,
      "castle": 15
    },
    "cost": {
      "food": 300000,
      "wood": 600000,
      "stone": 450000,
      "gold": 1650000
    },
    "baseDurationMs": 36000000,
    "prerequisites": [
      "research.cooperation"
    ],
    "milestone": 0,
    "civilizationId": "civ_zhongguo",
    "scope": "modern-civilization",
    "category": "civilization",
    "effect": "自動步槍兵、機槍支援兵、近衛自動步槍隊攻擊間隔 −8%",
    "status": "CALIBRATE"
  },
  {
    "id": "modern.civ_byzantium.exclusive",
    "name": "主動防護系統",
    "age": 0,
    "buildings": {
      "academy": 15,
      "castle": 15
    },
    "cost": {
      "food": 350000,
      "wood": 250000,
      "stone": 1100000,
      "gold": 1300000
    },
    "baseDurationMs": 36000000,
    "prerequisites": [
      "research.cooperation"
    ],
    "milestone": 0,
    "civilizationId": "civ_byzantium",
    "scope": "modern-civilization",
    "category": "civilization",
    "effect": "裝甲偵察車、主力戰車、帝國重裝甲衛隊 HP +12%",
    "status": "CALIBRATE"
  },
  {
    "id": "modern.civ_frankia.exclusive",
    "name": "裝甲量產體系",
    "age": 0,
    "buildings": {
      "academy": 15,
      "castle": 15
    },
    "cost": {
      "food": 750000,
      "wood": 250000,
      "stone": 650000,
      "gold": 1350000
    },
    "baseDurationMs": 36000000,
    "prerequisites": [
      "research.cooperation"
    ],
    "milestone": 0,
    "civilizationId": "civ_frankia",
    "scope": "modern-civilization",
    "category": "civilization",
    "effect": "裝甲偵察車、主力戰車新造成本 −12%；不折扣10%改裝價",
    "status": "CALIBRATE"
  },
  {
    "id": "modern.civ_britannia.exclusive",
    "name": "精確獵殺學說",
    "age": 0,
    "buildings": {
      "academy": 15,
      "castle": 15
    },
    "cost": {
      "food": 250000,
      "wood": 600000,
      "stone": 300000,
      "gold": 1850000
    },
    "baseDurationMs": 36000000,
    "prerequisites": [
      "research.cooperation"
    ],
    "milestone": 0,
    "civilizationId": "civ_britannia",
    "scope": "modern-civilization",
    "category": "civilization",
    "effect": "皇家狙擊衛隊對指定現代人員目標最終傷害 ×1.20",
    "status": "CALIBRATE"
  },
  {
    "id": "modern.civ_japan.exclusive",
    "name": "精銳殲滅教範",
    "age": 0,
    "buildings": {
      "academy": 15,
      "castle": 15
    },
    "cost": {
      "food": 650000,
      "wood": 350000,
      "stone": 450000,
      "gold": 1550000
    },
    "baseDurationMs": 36000000,
    "prerequisites": [
      "research.cooperation"
    ],
    "milestone": 0,
    "civilizationId": "civ_japan",
    "scope": "modern-civilization",
    "category": "civilization",
    "effect": "近衛突擊隊對現代文明衛隊 ×1.60；機械化突擊步兵對文明衛隊 ×1.20",
    "status": "CALIBRATE"
  },
  {
    "id": "modern.civ_mongolia.exclusive",
    "name": "高速機械化縱隊",
    "age": 0,
    "buildings": {
      "academy": 15,
      "castle": 15
    },
    "cost": {
      "food": 850000,
      "wood": 350000,
      "stone": 450000,
      "gold": 1350000
    },
    "baseDurationMs": 36000000,
    "prerequisites": [
      "research.cooperation"
    ],
    "milestone": 0,
    "civilizationId": "civ_mongolia",
    "scope": "modern-civilization",
    "category": "civilization",
    "effect": "現代車輛與機動火力衛隊等行軍時間 −15%；補給卡車載重 +20%",
    "status": "CALIBRATE"
  }
] as TechDefinition[]).map(t=>[t.id,t])));
export const BLACKSMITH_CAPS:Readonly<Record<string,readonly number[]>>={civ_zhongguo:[2,3,3,2,2],civ_byzantium:[2,2,3,3,3],civ_frankia:[3,2,2,2,3],civ_britannia:[2,3,2,3,2],civ_japan:[3,2,3,2,2],civ_mongolia:[2,3,2,2,3]};
export const BLACKSMITH_LINES=['melee','ranged','infantry-armor','ranged-armor','cavalry-armor'] as const;
